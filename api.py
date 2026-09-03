"""
api.py — FastAPI Support Assistant
Améliorations :
  ✅ Streaming SSE responses (/api/chat/stream)
  ✅ Rate limiting par IP + par user
  ✅ Session cleanup automatique (TTL configurable)
  ✅ Logging structuré (structlog / logging JSON)
  ✅ Health checks détaillés (/api/health, /api/health/ready, /api/health/live)
  ✅ Graceful degradation (fallbacks Elium → local → erreur propre)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
import threading
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import AsyncGenerator, List, Optional

import numpy as np
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

# =====================================================
# BOOTSTRAP
# =====================================================

API_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(API_DIR, ".env"))
load_dotenv()

import logic  # noqa: E402 — doit être après load_dotenv

# =====================================================
# LOGGING STRUCTURÉ
# =====================================================

_LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
_LOG_FORMAT = os.getenv("LOG_FORMAT", "json")  # "json" | "text"


class _JsonFormatter(logging.Formatter):
    """Formateur JSON minimaliste compatible avec la plupart des agrégateurs de logs."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "ts": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        # Champs supplémentaires injectés via record.__dict__
        for key in ("conv_id", "user", "prompt_len", "source", "duration_ms"):
            if key in record.__dict__:
                payload[key] = record.__dict__[key]
        return json.dumps(payload, ensure_ascii=False)


def _setup_logging() -> logging.Logger:
    root = logging.getLogger()
    root.setLevel(_LOG_LEVEL)
    # Supprimer les handlers existants pour éviter les doublons
    root.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        _JsonFormatter() if _LOG_FORMAT == "json"
        else logging.Formatter("%(asctime)s %(levelname)-8s %(name)s | %(message)s")
    )
    root.addHandler(handler)
    # Réduire le bruit des bibliothèques tierces
    for noisy in ("httpx", "httpcore", "langchain", "chromadb", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    return logging.getLogger("api")


logger = _setup_logging()

# =====================================================
# CONFIGURATION
# =====================================================

SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "3600"))       # 1h
SESSION_CLEANUP_INTERVAL = int(os.getenv("SESSION_CLEANUP_INTERVAL", "300"))  # 5 min
RATE_LIMIT_RPM = int(os.getenv("RATE_LIMIT_RPM", "30"))        # requêtes / minute / clé
RATE_LIMIT_BURST = int(os.getenv("RATE_LIMIT_BURST", "10"))    # burst max simultané
MAX_PROMPT_LENGTH = int(os.getenv("MAX_PROMPT_LENGTH", "4000"))

# =====================================================
# RATE LIMITER (token bucket simple, thread-safe)
# =====================================================

class _TokenBucket:
    """Token bucket par clé (IP ou user)."""

    def __init__(self, rate_per_minute: int, burst: int):
        self._rate = rate_per_minute / 60.0   # tokens/seconde
        self._burst = burst
        self._buckets: dict[str, tuple[float, float]] = {}  # key → (tokens, last_ts)
        self._lock = threading.Lock()

    def consume(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            tokens, last_ts = self._buckets.get(key, (float(self._burst), now))
            elapsed = now - last_ts
            tokens = min(self._burst, tokens + elapsed * self._rate)
            if tokens < 1.0:
                self._buckets[key] = (tokens, now)
                return False
            self._buckets[key] = (tokens - 1.0, now)
            return True

    def cleanup(self, max_age_seconds: float = 300.0) -> int:
        now = time.monotonic()
        with self._lock:
            stale = [k for k, (_, ts) in self._buckets.items() if now - ts > max_age_seconds]
            for k in stale:
                del self._buckets[k]
        return len(stale)


_rate_limiter = _TokenBucket(RATE_LIMIT_RPM, RATE_LIMIT_BURST)


def _rate_limit_key(request: Request, user_email: str = "") -> str:
    """Clé de rate limiting : user_email si fourni, sinon IP cliente."""
    if user_email:
        return f"user:{user_email}"
    forwarded = request.headers.get("X-Forwarded-For", "")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    return f"ip:{ip}"


# =====================================================
# SESSION STORE avec TTL
# =====================================================

class _SessionStore:
    """
    Dictionnaire de sessions avec TTL et nettoyage automatique.
    Thread-safe via RLock.
    """

    def __init__(self, ttl_seconds: int = SESSION_TTL_SECONDS):
        self._ttl = ttl_seconds
        self._store: dict[str, dict] = {}
        self._timestamps: dict[str, float] = {}
        self._lock = threading.RLock()

    def get(self, key: str) -> dict:
        with self._lock:
            self._touch(key)
            if key not in self._store:
                self._store[key] = logic.build_default_state()
                logger.info("New session created", extra={"conv_id": key[:32]})
            return self._store[key]

    def _touch(self, key: str) -> None:
        self._timestamps[key] = time.monotonic()

    def cleanup(self) -> int:
        threshold = time.monotonic() - self._ttl
        with self._lock:
            expired = [k for k, ts in self._timestamps.items() if ts < threshold]
            for k in expired:
                self._store.pop(k, None)
                self._timestamps.pop(k, None)
        if expired:
            logger.info("Sessions expired", extra={"count": len(expired)})
        return len(expired)

    def stats(self) -> dict:
        with self._lock:
            return {
                "active_sessions": len(self._store),
                "ttl_seconds": self._ttl,
            }


_sessions = _SessionStore(SESSION_TTL_SECONDS)

# =====================================================
# ÉTAT GLOBAL (partagé entre requêtes)
# =====================================================

_qa_chain = None
_qa_chain_drive = None
_qa_sources_state: dict = {}
_elium_runtime_config: dict = {}
_elium_docs_cache: list = []
_elium_embeddings_cache: list = []
_startup_time: float = 0.0
_startup_complete = False

# =====================================================
# TÂCHE DE NETTOYAGE EN ARRIÈRE-PLAN
# =====================================================

async def _background_cleanup():
    """Nettoyage périodique des sessions expirées et des buckets de rate limiting."""
    while True:
        await asyncio.sleep(SESSION_CLEANUP_INTERVAL)
        try:
            expired_sessions = _sessions.cleanup()
            cleaned_buckets = _rate_limiter.cleanup()
            if expired_sessions or cleaned_buckets:
                logger.info(
                    "Background cleanup",
                    extra={"expired_sessions": expired_sessions, "cleaned_rate_buckets": cleaned_buckets},
                )
        except Exception as exc:
            logger.warning("Background cleanup error", extra={"error": str(exc)})


# =====================================================
# LIFESPAN (remplace @app.on_event deprecated)
# =====================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _qa_chain, _qa_chain_drive, _qa_sources_state, _elium_runtime_config
    global _elium_docs_cache, _elium_embeddings_cache, _startup_time, _startup_complete

    _startup_time = time.monotonic()
    logger.info("API starting up")

    api_key = os.getenv("GROQ_API_KEY", "")
    gdrive_key = os.getenv("GDRIVE_API_KEY", "")
    elium_base_url = os.getenv("ELIUM_BASE_URL", "https://cover-group.elium.com")
    elium_email = os.getenv("ELIUM_EMAIL", "")
    elium_password = os.getenv("ELIUM_PASSWORD", "")
    preindex_elium = os.getenv("ELIUM_PREINDEX_ON_STARTUP", "false").strip().lower() == "true"

    # ── Drive ────────────────────────────────────────────────────────────
    docs_dir, summary, error = logic.download_docs_from_drive(gdrive_api_key=gdrive_key)
    logic.DOCS_DIR = docs_dir
    if summary:
        logger.info("Drive download", extra={"summary": summary})
    if error:
        logger.warning("Drive download error", extra={"error": error})

    if not api_key:
        logger.warning("GROQ_API_KEY missing — RAG disabled")
    else:
        logger.info("GROQ_API_KEY found")

    # ── Elium ────────────────────────────────────────────────────────────
    elium_enabled = bool(elium_email and elium_password)
    elium_ready = False
    elium_indexed_count = 0
    elium_debug = "Elium disabled (no credentials)"

    if elium_enabled:
        try:
            elium_ready, elium_debug = logic.check_elium_graphql_access(
                base_url=elium_base_url,
                login_email=elium_email,
                login_password=elium_password,
            )
            logger.info("Elium GraphQL check", extra={"status": elium_debug})
        except Exception as exc:
            elium_debug = f"Elium check failed: {exc}"
            logger.warning("Elium check error", extra={"error": str(exc)})

    # ── Documents locaux ─────────────────────────────────────────────────
    local_documents = []
    try:
        local_documents = logic.load_local_documents(docs_dir)
        logger.info("Local documents loaded", extra={"count": len(local_documents)})
    except Exception as exc:
        logger.error("Failed to load local documents", extra={"error": str(exc)})

    # ── Elium index ──────────────────────────────────────────────────────
    elium_local_docs = []
    try:
        elium_local_docs = logic.load_elium_index_from_file(docs_dir)
        if elium_local_docs:
            logger.info("Elium local index loaded", extra={"count": len(elium_local_docs)})
        elif preindex_elium and elium_ready:
            logger.info("Starting Elium pre-indexing")
            elium_indexed_count, index_debug = logic.index_all_elium_locally(
                base_url=elium_base_url,
                login_email=elium_email,
                login_password=elium_password,
                docs_dir=docs_dir,
            )
            logger.info("Elium pre-indexing done", extra={"indexed": elium_indexed_count, "debug": index_debug})
            elium_local_docs = logic.load_elium_index_from_file(docs_dir)
        else:
            logger.info("Elium pre-index skipped (disabled or Elium unavailable)")
    except Exception as exc:
        logger.error("Elium index error", extra={"error": str(exc)})

    _elium_docs_cache = elium_local_docs

    # ── Pré-calcul embeddings Elium ──────────────────────────────────────
    if _elium_docs_cache:
        try:
            logger.info("Pre-computing Elium embeddings", extra={"count": len(_elium_docs_cache)})
            embed_model = logic.get_embed_model()
            _elium_embeddings_cache = [
                embed_model.embed_query(doc.page_content)
                for doc in _elium_docs_cache
            ]
            logger.info("Elium embeddings ready", extra={"count": len(_elium_embeddings_cache)})
        except Exception as exc:
            logger.error("Elium embedding pre-computation failed", extra={"error": str(exc)})
            _elium_embeddings_cache = []

    # ── Construction QA chain ────────────────────────────────────────────
    all_documents = local_documents + elium_local_docs
    logger.info(
        "Total documents",
        extra={"total": len(all_documents), "local": len(local_documents), "elium": len(elium_local_docs)},
    )

    if api_key and all_documents:
        try:
            _qa_chain_drive = logic.build_qa_chain_from_documents(all_documents, api_key=api_key, retriever_k=8)
            _qa_chain = _qa_chain_drive
            logger.info("QA chain built successfully")
        except Exception as exc:
            logger.error("QA chain build failed", extra={"error": str(exc)})
            _qa_chain = None
            _qa_chain_drive = None
    else:
        _qa_chain = None
        _qa_chain_drive = None
        if not api_key:
            logger.warning("QA chain skipped: no API key")
        if not all_documents:
            logger.warning("QA chain skipped: no documents")

    _elium_runtime_config = {
        "enabled": elium_enabled,
        "ready": elium_ready,
        "base_url": elium_base_url,
        "email": elium_email,
        "password": elium_password,
        "preindex_enabled": preindex_elium,
        "indexed_count": elium_indexed_count,
    }

    _qa_sources_state = {
        "docs_dir": docs_dir,
        "local_documents_count": len(local_documents),
        "elium_indexed_count": elium_indexed_count,
        "elium_local_loaded": len(elium_local_docs),
        "total_documents": len(all_documents),
        "elium_status": elium_debug,
        "elium_runtime_enabled": elium_enabled,
        "elium_runtime_ready": elium_ready,
        "qa_ready": _qa_chain is not None,
    }

    _startup_complete = True
    elapsed = (time.monotonic() - _startup_time) * 1000
    logger.info("Startup complete", extra={"duration_ms": round(elapsed, 1), "qa_ready": _qa_chain is not None})

    # Lancer le nettoyage en arrière-plan
    cleanup_task = asyncio.create_task(_background_cleanup())

    yield

    # Shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    logger.info("API shut down cleanly")


# =====================================================
# CORS
# =====================================================

def _parse_cors_origins(raw_value: str) -> list[str]:
    if not raw_value.strip():
        return ["*"]
    origins = [o.strip().rstrip("/") for o in raw_value.split(",") if o.strip()]
    return origins or ["*"]


_cors_allowed_origins = _parse_cors_origins(os.getenv("CORS_ALLOWED_ORIGINS", "*"))
_cors_allow_credentials = os.getenv("CORS_ALLOW_CREDENTIALS", "false").strip().lower() == "true"

if "*" in _cors_allowed_origins and _cors_allow_credentials:
    logger.warning("CORS_ALLOW_CREDENTIALS=true ignored with wildcard origins")
    _cors_allow_credentials = False

# =====================================================
# APP
# =====================================================

app = FastAPI(
    title="Support Assistant API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allowed_origins,
    allow_credentials=_cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# =====================================================
# MIDDLEWARE — Logging des requêtes
# =====================================================

@app.middleware("http")
async def _request_logger(request: Request, call_next):
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = round((time.monotonic() - start) * 1000, 1)
    logger.info(
        "HTTP request",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    return response

# =====================================================
# UTILITAIRES INTERNES
# =====================================================

def _get_filename_from_url_safe(url: str) -> str:
    try:
        from urllib.parse import urlparse, unquote
        parsed = urlparse(url)
        name = unquote(os.path.basename(parsed.path.rstrip("/")))
        return name if name else url
    except Exception:
        return url


def _score_elium_with_cache(query_embedding: list, threshold: float = 0.25, top_k: int = 6):
    from sklearn.metrics.pairwise import cosine_similarity as cos_sim

    if not _elium_embeddings_cache or not _elium_docs_cache:
        return []
    query_arr = np.array(query_embedding).reshape(1, -1)
    doc_arr = np.array(_elium_embeddings_cache)
    scores = cos_sim(query_arr, doc_arr)[0]
    scored = sorted(
        [(float(scores[i]), _elium_docs_cache[i]) for i in range(len(scores))],
        key=lambda x: x[0],
        reverse=True,
    )
    return [(score, doc) for score, doc in scored if score > threshold][:top_k]

# =====================================================
# SCHÉMAS PYDANTIC
# =====================================================

class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    prompt: str
    conversation_id: Optional[str] = "default"
    messages: Optional[List[Message]] = None
    user_email: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    type: str
    images_b64: List[str] = []


# =====================================================
# LOGIQUE MÉTIER COMMUNE (partagée chat + stream)
# =====================================================

async def _resolve_chat(
    prompt: str,
    state: dict,
    conv_id: str,
) -> tuple[str, str, bool, list]:
    """
    Résout la logique métier complète pour un prompt donné.
    Retourne : (full_response, response_type, should_extract_images, best_docs)
    """
    prompt_lower = prompt.lower().strip()
    full_response = ""
    response_type = "answer"
    best_docs: list = []
    should_extract_images = False

    active_qa_chain = _qa_chain_drive or _qa_chain

    # ── PRIORITÉ 0 : Salutations ──────────────────────────────────────────
    GREETINGS_MAP = {
        "bonjour": "Bonjour ! 👋 Comment puis-je vous aider aujourd'hui ?",
        "bonsoir": "Bonsoir ! 👋 Comment puis-je vous aider ?",
        "salut": "Salut ! 👋 En quoi puis-je vous aider ?",
        "hello": "Hello ! 👋 Comment puis-je vous aider ?",
        "hi": "Hi ! 👋 Comment puis-je vous aider ?",
        "coucou": "Coucou ! 😊 Comment puis-je vous aider ?",
        "hey": "Hey ! 👋 Comment puis-je vous aider ?",
        "merci": "Avec plaisir ! 😊 N'hésitez pas si vous avez d'autres questions.",
        "merci beaucoup": "Avec plaisir ! 😊 N'hésitez pas si vous avez d'autres questions.",
        "ok merci": "De rien ! 😊 N'hésitez pas si vous avez besoin d'autre chose.",
        "super merci": "Avec plaisir ! 😊 Bonne continuation !",
        "parfait merci": "Avec plaisir ! 😊 Bonne continuation !",
        "thank you": "You're welcome! 😊 Feel free to ask if you need anything else.",
        "thanks": "You're welcome! 😊",
        "au revoir": "Au revoir ! 👋 À bientôt !",
        "à bientôt": "À bientôt ! 👋",
        "bye": "Bye ! 👋",
        "ciao": "Ciao ! 👋",
        "bonne journée": "Merci, bonne journée à vous aussi ! 😊",
        "bonne soirée": "Merci, bonne soirée à vous aussi ! 😊",
        "bonne nuit": "Bonne nuit ! 😴",
    }
    _greeting_match = None
    if prompt_lower in GREETINGS_MAP:
        _greeting_match = prompt_lower
    else:
        for g in sorted(GREETINGS_MAP.keys(), key=len, reverse=True):
            if prompt_lower.startswith(g + " ") or prompt_lower.startswith(g + "!") or prompt_lower.startswith(g + ","):
                _greeting_match = g
                break

    if _greeting_match:
        return GREETINGS_MAP[_greeting_match], "greeting", False, []

    # ── PRIORITÉ 2 : Action licence ───────────────────────────────────────
    if not full_response and "active ma licence cover" in prompt_lower:
        return "⚠️ L'activation de licence nécessite une action locale sur votre PC.", "info", False, []

    # ── PRIORITÉ 3 : Requêtes chaînées ────────────────────────────────────
    if not full_response:
        chained_brand = None
        try:
            chained_brand = logic.detect_chained_request(prompt, logic.DOCS_DIR)
        except Exception as exc:
            logger.warning("Chained request detection error", extra={"error": str(exc)})

        if chained_brand and state.get("last_action"):
            action = state["last_action"]
            if action == "list_versions":
                full_response = logic.format_versions_response(chained_brand, logic.get_versions_with_urls(chained_brand, logic.DOCS_DIR))
                state["last_action_brand"] = chained_brand
                response_type = "list"
            elif action == "version_url":
                version = state.get("last_version")
                if version:
                    results = logic.search_all_versions(version, chained_brand, logic.DOCS_DIR)
                    full_response = (
                        f"**{chained_brand}** — version {version} :\n{logic.get_direct_response(version, results)}"
                        if results else f"Aucune URL trouvée pour la version **{version}** chez **{chained_brand}**."
                    )
                    response_type = "version" if results else "error"
                else:
                    full_response = "Je n'ai pas de version en mémoire. Veuillez préciser la version."
                    response_type = "error"
                state["last_action_brand"] = chained_brand
            elif action == "list_providers":
                full_response = logic.format_providers_response(chained_brand, logic.get_providers_with_urls(chained_brand, logic.DOCS_DIR))
                state["last_action_brand"] = chained_brand
                response_type = "list"
            elif action == "provider_url":
                provider = state.get("last_provider")
                if provider:
                    results = logic.search_all_providers_by_number(provider, chained_brand, logic.DOCS_DIR)
                    full_response = (
                        f"**{chained_brand}** — provider {provider} :\n{logic.get_provider_number_response(provider, results)}"
                        if results else f"Aucune URL trouvée pour le provider **{provider}** chez **{chained_brand}**."
                    )
                    response_type = "provider" if results else "error"
                else:
                    full_response = "Je n'ai pas de numéro de provider en mémoire. Veuillez préciser le provider."
                    response_type = "error"
                state["last_action_brand"] = chained_brand

    # ── PRIORITÉ 3.5 : Flux d'installation ───────────────────────────────
    if not full_response:
        if state.get("awaiting_install_version"):
            _install_brand = state.get("pending_install_brand")
            _vmatch = logic.VERSION_REGEX.search(prompt)
            if _vmatch:
                _ver = _vmatch.group(0)
                _res = logic.search_all_versions(_ver, _install_brand, logic.DOCS_DIR)
                state["last_version"] = _ver
                state["last_brand"] = _install_brand
                state["awaiting_install_version"] = False
                state["pending_install_brand"] = None
                if _res:
                    _url_r = logic.get_direct_response(_ver, _res)
                    state["last_action"] = "version_url"
                    state["last_action_brand"] = _install_brand
                    state["awaiting_provider_offer"] = True
                    state["pending_provider_brand"] = _install_brand
                    full_response = (
                        f"✅ Voici le lien d'installation pour la version **{_ver}**"
                        f"{(' (' + _install_brand + ')') if _install_brand else ''} :\n\n"
                        f"{_url_r}\n\n---\n💡 Souhaitez-vous également le provider lié à cette version ?"
                    )
                    response_type = "version"
                else:
                    full_response = (
                        f"❌ Aucune URL trouvée pour la version **{_ver}**"
                        f"{(' chez **' + _install_brand + '**') if _install_brand else ''}.\n\n"
                        "Veuillez vérifier le numéro de version et réessayer."
                    )
                    response_type = "error"
            else:
                full_response = (
                    "Je n'ai pas trouvé de numéro de version dans votre réponse.\n\n"
                    f"Quelle version souhaitez-vous installer"
                    f"{(' pour **' + _install_brand + '**') if _install_brand else ''} ? "
                    "(exemple : `2.3.1.3087`)"
                )
                response_type = "question"

        elif state.get("awaiting_provider_offer"):
            _prov_brand = state.get("pending_provider_brand")
            if logic.is_affirmative(prompt):
                state["awaiting_provider_offer"] = False
                state["awaiting_provider_version"] = True
                _available_providers = logic.get_providers_with_urls(_prov_brand, logic.DOCS_DIR) if _prov_brand else []
                if _available_providers:
                    _prov_list = "\n".join(
                        f"- `{_get_filename_from_url_safe(p['url'])}`"
                        for p in _available_providers if p.get("url")
                    )
                    full_response = (
                        f"Voici les providers disponibles pour **{_prov_brand}** :\n\n{_prov_list}\n\n"
                        "Entrez le numéro du provider souhaité _(ex : `2603`)_ :"
                    )
                else:
                    full_response = f"Quel est le numéro du provider pour **{_prov_brand}** ?\n\n_(Entrez le numéro de provider, ex : `2603`)_"
                response_type = "question"
            elif logic.is_negative(prompt):
                state["awaiting_provider_offer"] = False
                state["pending_provider_brand"] = None
                full_response = "D'accord ! N'hésitez pas si vous avez d'autres questions. 😊"
                response_type = "answer"

        elif state.get("awaiting_provider_version"):
            _prov_brand2 = state.get("pending_provider_brand")
            _is_list_request = any(kw in prompt_lower for kw in ["liste", "list", "disponible", "tous", "toutes", "quels", "montre"])
            if _is_list_request:
                _avail = logic.get_providers_with_urls(_prov_brand2, logic.DOCS_DIR) if _prov_brand2 else []
                if _avail:
                    full_response = logic.format_providers_response(_prov_brand2 or "?", _avail)
                    full_response += "\n\n_Entrez le numéro du provider souhaité (ex : `2603`) :_"
                else:
                    full_response = f"Aucun provider trouvé pour **{_prov_brand2}**.\n\nVérifiez la marque ou contactez le support."
                response_type = "list"
            else:
                _prov_num = logic.extract_provider_number(prompt)
                if _prov_num:
                    _res2 = logic.search_all_providers_by_number(_prov_num, _prov_brand2, logic.DOCS_DIR)
                    state["last_provider"] = _prov_num
                    state["awaiting_provider_version"] = False
                    state["pending_provider_brand"] = None
                    if _res2:
                        full_response = (
                            f"✅ Voici le lien du provider **{_prov_num}**"
                            f"{(' (' + _prov_brand2 + ')') if _prov_brand2 else ''} :\n\n"
                            f"{logic.get_provider_number_response(_prov_num, _res2)}"
                        )
                        state["last_action"] = "provider_url"
                        state["last_action_brand"] = _prov_brand2
                        response_type = "provider"
                    else:
                        full_response = (
                            f"❌ Aucune URL trouvée pour le provider **{_prov_num}**"
                            f"{(' chez **' + _prov_brand2 + '**') if _prov_brand2 else ''}."
                        )
                        response_type = "error"
                else:
                    _avail2 = logic.get_providers_with_urls(_prov_brand2, logic.DOCS_DIR) if _prov_brand2 else []
                    if _avail2:
                        _prov_list2 = "\n".join(
                            f"- `{_get_filename_from_url_safe(p['url'])}`"
                            for p in _avail2 if p.get("url")
                        )
                        full_response = (
                            "Je n'ai pas trouvé de numéro de provider dans votre réponse.\n\n"
                            f"Voici les providers disponibles pour **{_prov_brand2}** :\n\n{_prov_list2}\n\n"
                            "Entrez le numéro souhaité _(ex : `2603`)_ :"
                        )
                    else:
                        full_response = (
                            "Je n'ai pas trouvé de numéro de provider.\n\n"
                            f"Quel provider souhaitez-vous{(' pour **' + _prov_brand2 + '**') if _prov_brand2 else ''} ? _(ex : `2603`)_"
                        )
                    response_type = "question"

    # ── PRIORITÉ 4 : Traitement normal ────────────────────────────────────
    if not full_response:
        specific_brand = logic.extract_brand_from_prompt(prompt, logic.DOCS_DIR)
        version_match = logic.VERSION_REGEX.search(prompt)
        provider_number = logic.extract_provider_number(prompt)
        is_provider_req = logic.is_provider_request(prompt)

        if specific_brand:
            state["last_brand"] = specific_brand

        if state.get("pending_version") and not is_provider_req and not provider_number:
            selected_brand = prompt.strip().lower()
            pending_brands = state.get("pending_brands", [])
            if selected_brand in [b.lower() for b in pending_brands]:
                results = logic.search_all_versions(state["pending_version"], selected_brand, logic.DOCS_DIR)
                full_response = logic.get_direct_response(state["pending_version"], results)
                state["last_action"] = "version_url"
                state["last_action_brand"] = selected_brand
                state["pending_version"] = None
                state["pending_brands"] = []
                response_type = "version"
            else:
                full_response = f"Marque non reconnue. Marques disponibles : {', '.join(pending_brands)}."
                response_type = "error"

        elif state.get("pending_provider") and not provider_number:
            selected_brand = prompt.strip().lower()
            pending_brands = state.get("pending_provider_brands", [])
            if selected_brand in [b.lower() for b in pending_brands]:
                results = logic.search_all_providers_by_number(state["pending_provider"], selected_brand, logic.DOCS_DIR)
                full_response = logic.get_provider_number_response(state["pending_provider"], results)
                state["last_action"] = "provider_url"
                state["last_action_brand"] = selected_brand
                state["pending_provider"] = None
                state["pending_provider_brands"] = []
                response_type = "provider"
            else:
                full_response = f"Marque non reconnue. Marques disponibles : {', '.join(pending_brands)}."
                response_type = "error"

        else:
            if state.get("pending_version"):
                state["pending_version"] = None
                state["pending_brands"] = []
            if state.get("pending_provider"):
                state["pending_provider"] = None
                state["pending_provider_brands"] = []

            if ("liste" in prompt_lower or "versions" in prompt_lower) and not is_provider_req:
                if specific_brand:
                    results = logic.get_versions_with_urls(specific_brand, logic.DOCS_DIR)
                    full_response = logic.format_versions_response(specific_brand, results)
                    state["last_action"] = "list_versions"
                    state["last_action_brand"] = specific_brand
                    response_type = "list"
                else:
                    full_response = "Veuillez préciser une marque pour la liste des versions."
                    response_type = "error"

            elif is_provider_req and specific_brand and not provider_number and not version_match:
                results = logic.get_providers_with_urls(specific_brand, logic.DOCS_DIR)
                full_response = logic.format_providers_response(specific_brand, results)
                state["last_action"] = "list_providers"
                state["last_action_brand"] = specific_brand
                response_type = "list"

            elif provider_number:
                state["last_provider"] = provider_number
                results = logic.search_all_providers_by_number(provider_number, specific_brand, logic.DOCS_DIR)
                if not results:
                    full_response = f"❌ Aucune URL trouvée pour le provider **{provider_number}**."
                    state["last_action"] = None
                    response_type = "error"
                else:
                    unique_brands = sorted({row["marque"] for row in results})
                    if specific_brand or len(unique_brands) == 1:
                        full_response = logic.get_provider_number_response(provider_number, results)
                        state["last_action"] = "provider_url"
                        state["last_action_brand"] = specific_brand or unique_brands[0]
                        response_type = "provider"
                    else:
                        state["pending_provider"] = provider_number
                        state["pending_provider_brands"] = unique_brands
                        state["last_action"] = None
                        full_response = (
                            f"Provider **{provider_number}** trouvé pour plusieurs marques : "
                            f"{', '.join(unique_brands)}.\nPour quelle marque souhaitez-vous le lien ?"
                        )
                        response_type = "question"

            elif logic.is_install_request(prompt) and specific_brand and not version_match:
                _inst_versions = logic.get_versions_with_urls(specific_brand, logic.DOCS_DIR)
                state["awaiting_install_version"] = True
                state["pending_install_brand"] = specific_brand
                state["last_action"] = None
                if _inst_versions:
                    _vlist = "\n".join(f"- `{v['version']}`" for v in _inst_versions if v.get("version"))
                    full_response = f"Quelle version souhaitez-vous installer pour **{specific_brand}** ?\n\nVersions disponibles :\n{_vlist}"
                else:
                    full_response = f"Quelle version souhaitez-vous installer pour **{specific_brand}** ?\n\n_(Entrez le numéro de version, ex : `2.3.1.3087`)_"
                response_type = "question"

            elif version_match:
                version = version_match.group(0)
                state["last_version"] = version
                results = logic.search_all_versions(version, specific_brand, logic.DOCS_DIR)
                if not results:
                    # Graceful degradation → RAG
                    if active_qa_chain:
                        try:
                            rag_result = active_qa_chain.invoke(prompt)
                            full_response = rag_result["result"] if isinstance(rag_result, dict) else str(rag_result)
                        except Exception as exc:
                            logger.warning("RAG fallback failed", extra={"error": str(exc)})
                            full_response = f"❌ Aucune URL trouvée pour la version **{version}**."
                        response_type = "answer"
                    else:
                        full_response = f"❌ Aucune URL trouvée pour la version **{version}**."
                        response_type = "error"
                    state["last_action"] = None
                else:
                    unique_brands = sorted({row["marque"] for row in results})
                    if specific_brand or len(unique_brands) == 1:
                        full_response = logic.get_direct_response(version, results)
                        state["last_action"] = "version_url"
                        state["last_action_brand"] = specific_brand or unique_brands[0]
                        response_type = "version"
                    else:
                        state["pending_version"] = version
                        state["pending_brands"] = unique_brands
                        state["last_action"] = None
                        full_response = (
                            f"Version **{version}** trouvée pour plusieurs marques : "
                            f"{', '.join(unique_brands)}.\nPour quelle marque souhaitez-vous le lien ?"
                        )
                        response_type = "question"

            elif active_qa_chain or _elium_runtime_config.get("enabled"):
                # ── RAG UNIFIÉ ─────────────────────────────────────────────
                try:
                    groq_api_key = os.getenv("GROQ_API_KEY", "")
                    conversation_history = state.get("messages", [])[-10:]
                    embed_model = logic.get_embed_model()

                    local_docs: list = []
                    local_scores: list = []
                    if active_qa_chain and hasattr(active_qa_chain, "retriever"):
                        try:
                            local_docs = active_qa_chain.retriever.invoke(prompt)
                            scored_local = logic.compute_embedding_similarity(prompt, local_docs)
                            local_docs = [doc for _, doc in scored_local]
                            local_scores = [score for score, _ in scored_local]
                        except Exception as exc:
                            logger.warning("Local retriever error", extra={"error": str(exc)})

                    elium_docs: list = []
                    elium_scores: list = []
                    if _elium_embeddings_cache:
                        try:
                            query_embedding = embed_model.embed_query(prompt)
                            relevant_elium = _score_elium_with_cache(query_embedding, threshold=0.25, top_k=6)
                            elium_docs = [doc for _, doc in relevant_elium]
                            elium_scores = [score for score, _ in relevant_elium]
                        except Exception as exc:
                            logger.warning("Elium cache scoring error", extra={"error": str(exc)})

                    best_local = local_scores[0] if local_scores else 0.0
                    best_elium_score = elium_scores[0] if elium_scores else 0.0
                    MARGIN = 0.05

                    if best_elium_score >= best_local + MARGIN:
                        best_docs = elium_docs
                        source_used = "elium"
                        should_extract_images = False
                    elif best_local >= best_elium_score + MARGIN:
                        best_docs = local_docs
                        source_used = "local"
                        has_pdf_sources = any(
                            str(doc.metadata.get("source", "")).lower().endswith(".pdf")
                            for doc in local_docs
                        )
                        should_extract_images = best_local >= 0.4 and has_pdf_sources
                    else:
                        best_docs = local_docs[:4] + elium_docs[:4]
                        source_used = "mixed"
                        should_extract_images = False

                    logger.info(
                        "RAG source selected",
                        extra={"source": source_used, "local_score": round(best_local, 3), "elium_score": round(best_elium_score, 3)},
                    )

                    if best_docs:
                        full_response = logic.answer_with_context_documents(
                            prompt=prompt,
                            documents=best_docs,
                            api_key=groq_api_key,
                            conversation_history=conversation_history,
                        )
                        response_type = "answer"
                        state["last_action"] = None
                        state["_source_used"] = source_used
                        state["_best_docs_for_images"] = best_docs
                    else:
                        # Graceful degradation : aucun doc pertinent
                        full_response = (
                            "❌ Je n'ai trouvé aucune information pertinente pour cette question.\n\n"
                            "Essayez de reformuler ou contactez le support Cover directement."
                        )
                        response_type = "error"
                        state["last_action"] = None
                        state["_best_docs_for_images"] = []

                except Exception as exc:
                    logger.error("RAG unified error", extra={"error": str(exc)})
                    # Graceful degradation : erreur RAG
                    full_response = (
                        "⚠️ Une erreur technique est survenue. "
                        "Veuillez réessayer ou contacter le support Cover."
                    )
                    response_type = "error"
                    state["last_action"] = None
                    state["_best_docs_for_images"] = []
                    should_extract_images = False

            else:
                full_response = "⚠️ Aucune base de documents chargée."
                response_type = "error"
                state["last_action"] = None
                state["_best_docs_for_images"] = []

    return full_response, response_type, should_extract_images, best_docs


# =====================================================
# ENDPOINT — CHAT (JSON classique)
# =====================================================

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, request: Request):
    t0 = time.monotonic()

    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le prompt est vide.")
    if len(prompt) > MAX_PROMPT_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Le prompt dépasse {MAX_PROMPT_LENGTH} caractères.",
        )

    user_email = (req.user_email or "").strip().lower()
    rl_key = _rate_limit_key(request, user_email)
    if not _rate_limiter.consume(rl_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de requêtes. Veuillez patienter quelques secondes.",
            headers={"Retry-After": "5"},
        )

    conv_id = req.conversation_id or "default"
    session_key = f"{user_email or 'anon'}::{conv_id}"
    state = _sessions.get(session_key)

    if req.messages:
        state["messages"] = [{"role": m.role, "content": m.content} for m in req.messages]
    elif "messages" not in state:
        state["messages"] = []

    logger.info(
        "Chat request",
        extra={"conv_id": session_key[:40], "prompt_len": len(prompt), "user": user_email or "anon"},
    )

    full_response, response_type, should_extract_images, best_docs = await _resolve_chat(prompt, state, conv_id)

    # ── Extraction d'images ───────────────────────────────────────────────
    images_b64: list[str] = []
    if should_extract_images and full_response and response_type == "answer":
        docs_for_images = state.get("_best_docs_for_images", best_docs)
        if docs_for_images:
            try:
                images_bytes, img_debug = logic.collect_relevant_images_for_response(
                    selected_docs=docs_for_images,
                    prompt=prompt,
                    llm_answer=full_response,
                    docs_dir=logic.DOCS_DIR,
                    min_relevance_score=0.45,
                )
                images_b64 = logic.images_to_base64(images_bytes)
                logger.info("Images extracted", extra={"count": len(images_b64)})
            except Exception as exc:
                logger.warning("Image extraction error", extra={"error": str(exc)})

    state["messages"].append({"role": "user", "content": prompt})
    state["messages"].append({"role": "assistant", "content": full_response, "images_b64": images_b64})
    state["current_conversation_id"] = conv_id

    duration_ms = round((time.monotonic() - t0) * 1000, 1)
    logger.info(
        "Chat response",
        extra={"type": response_type, "duration_ms": duration_ms, "images": len(images_b64)},
    )

    return ChatResponse(response=full_response, type=response_type, images_b64=images_b64)


# =====================================================
# ENDPOINT — CHAT STREAM (SSE)
# =====================================================

@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest, request: Request):
    """
    Streaming SSE du chat.
    Format des événements :
      data: {"type": "chunk",  "text": "..."}
      data: {"type": "done",   "response_type": "...", "images_b64": [...]}
      data: {"type": "error",  "detail": "..."}
    """
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le prompt est vide.")
    if len(prompt) > MAX_PROMPT_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Le prompt dépasse {MAX_PROMPT_LENGTH} caractères.",
        )

    user_email = (req.user_email or "").strip().lower()
    rl_key = _rate_limit_key(request, user_email)
    if not _rate_limiter.consume(rl_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de requêtes. Veuillez patienter quelques secondes.",
            headers={"Retry-After": "5"},
        )

    conv_id = req.conversation_id or "default"
    session_key = f"{user_email or 'anon'}::{conv_id}"
    state = _sessions.get(session_key)

    if req.messages:
        state["messages"] = [{"role": m.role, "content": m.content} for m in req.messages]
    elif "messages" not in state:
        state["messages"] = []

    async def _event_generator() -> AsyncGenerator[str, None]:
        full_response_parts: list[str] = []
        response_type = "answer"
        images_b64: list[str] = []

        try:
            # Résoudre d'abord la logique non-RAG (versions, providers, salutations…)
            # Pour les réponses déjà complètes (non-RAG), on envoie en un seul chunk.
            full_response_preview, response_type, should_extract_images, best_docs = await _resolve_chat(
                prompt, state, conv_id
            )

            # Si la réponse est de type "answer" (RAG) et qu'on a des docs, on streame.
            # Sinon on envoie directement.
            if response_type == "answer" and state.get("_best_docs_for_images") is not None:
                groq_api_key = os.getenv("GROQ_API_KEY", "")
                rag_docs = state.get("_best_docs_for_images", best_docs)
                conversation_history = state.get("messages", [])[-10:]

                # On streame depuis le générateur LLM
                streamed_text = ""
                try:
                    for chunk in logic.answer_with_context_documents_stream(
                        prompt=prompt,
                        documents=rag_docs,
                        api_key=groq_api_key,
                        conversation_history=conversation_history,
                    ):
                        streamed_text += chunk
                        event = json.dumps({"type": "chunk", "text": chunk}, ensure_ascii=False)
                        yield f"data: {event}\n\n"
                        await asyncio.sleep(0)  # yield au event loop
                    full_response_parts.append(streamed_text)
                except Exception as exc:
                    logger.error("Streaming LLM error", extra={"error": str(exc)})
                    error_event = json.dumps({"type": "error", "detail": str(exc)}, ensure_ascii=False)
                    yield f"data: {error_event}\n\n"
                    return

                full_response = "".join(full_response_parts)

                # Extraction d'images (post-stream)
                if should_extract_images and full_response:
                    try:
                        imgs_bytes, _ = logic.collect_relevant_images_for_response(
                            selected_docs=rag_docs,
                            prompt=prompt,
                            llm_answer=full_response,
                            docs_dir=logic.DOCS_DIR,
                            min_relevance_score=0.45,
                        )
                        images_b64 = logic.images_to_base64(imgs_bytes)
                    except Exception as exc:
                        logger.warning("Stream image extraction error", extra={"error": str(exc)})

            else:
                # Réponse non-RAG : envoyer en un seul chunk
                full_response = full_response_preview
                event = json.dumps({"type": "chunk", "text": full_response}, ensure_ascii=False)
                yield f"data: {event}\n\n"

            # Mettre à jour la session
            state["messages"].append({"role": "user", "content": prompt})
            state["messages"].append({"role": "assistant", "content": full_response, "images_b64": images_b64})
            state["current_conversation_id"] = conv_id

            # Événement de fin
            done_event = json.dumps(
                {"type": "done", "response_type": response_type, "images_b64": images_b64},
                ensure_ascii=False,
            )
            yield f"data: {done_event}\n\n"

        except Exception as exc:
            logger.error("Stream generator error", extra={"error": str(exc)})
            error_event = json.dumps({"type": "error", "detail": "Erreur interne du serveur."}, ensure_ascii=False)
            yield f"data: {error_event}\n\n"

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # désactive le buffering nginx
        },
    )


# =====================================================
# HEALTH CHECKS
# =====================================================

@app.get("/api/health/live", tags=["health"])
async def health_live():
    """Liveness probe — répond 200 tant que le process tourne."""
    return {"status": "alive", "ts": datetime.utcnow().isoformat() + "Z"}


@app.get("/api/health/ready", tags=["health"])
async def health_ready():
    """
    Readiness probe — répond 200 uniquement si le démarrage est terminé.
    Répond 503 si le startup n'est pas encore complet (utile pour K8s).
    """
    if not _startup_complete:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not ready yet — startup in progress.",
        )
    if not (_qa_chain or _elium_runtime_config.get("enabled")):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not ready — no QA chain and Elium disabled.",
        )
    return {"status": "ready", "ts": datetime.utcnow().isoformat() + "Z"}


@app.get("/api/health", tags=["health"])
async def health():
    """Health check détaillé (monitoring)."""
    docs_dir = logic.DOCS_DIR
    files_in_docs = []
    try:
        files_in_docs = os.listdir(docs_dir) if os.path.exists(docs_dir) else []
    except Exception:
        pass

    uptime_seconds = round(time.monotonic() - _startup_time, 1) if _startup_time else 0

    payload = {
        "status": "ok" if _startup_complete else "starting",
        "ts": datetime.utcnow().isoformat() + "Z",
        "uptime_seconds": uptime_seconds,
        "startup_complete": _startup_complete,
        # QA / RAG
        "qa_ready": _qa_chain is not None,
        "qa_drive_ready": _qa_chain_drive is not None,
        # Documents
        "docs_dir": docs_dir,
        "files_in_docs": files_in_docs,
        "files_count": len(files_in_docs),
        # Elium
        "elium_enabled": _elium_runtime_config.get("enabled", False),
        "elium_ready": _elium_runtime_config.get("ready", False),
        "elium_docs_cached": len(_elium_docs_cache),
        "elium_embeddings_cached": len(_elium_embeddings_cache),
        # Sessions
        **_sessions.stats(),
        # Rate limiting
        "rate_limit_rpm": RATE_LIMIT_RPM,
        "rate_limit_burst": RATE_LIMIT_BURST,
    }
    payload.update(_qa_sources_state)
    return payload


# =====================================================
# MAIN
# =====================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=False,
        log_level="info",
    )