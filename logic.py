"""
logic.py — Fonctions métier du ChatBoot Cover
Aucune dépendance Streamlit dans ce fichier.
"""

import os
import re
import json
import base64
import hashlib
import html
import subprocess
import tempfile
import shutil
import io
from collections import Counter
from datetime import datetime
from urllib.parse import urljoin, urlparse

import pandas as pd
import requests
import fitz
from PIL import Image
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_classic.chains import RetrievalQA
from langchain_core.documents import Document
from langchain_groq import ChatGroq
from sklearn.metrics.pairwise import cosine_similarity
from urllib.parse import urlparse, unquote
import numpy as np

# =====================================================
# MODÈLE D'EMBEDDINGS PARTAGÉ (singleton)
# =====================================================

_EMBED_MODEL = None

def get_embed_model():
    global _EMBED_MODEL
    if _EMBED_MODEL is None:
        _EMBED_MODEL = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    return _EMBED_MODEL

# =====================================================
# CONFIGURATION GLOBALE
# =====================================================

GDRIVE_FOLDER_ID = "1oz01FMVvm5HTIcS_U2hKqYVu9ZRL8QZU"
DOCS_DIR = os.path.join(tempfile.gettempdir(), "chatboot_docs")

MAX_IMAGES_PER_RESPONSE = 6
URL_REGEX = re.compile(r"https?://[^\s<>\"]+")
VERSION_REGEX = re.compile(r"\d+\.\d+\.\d+\.\d+")
PROVIDER_HINTS = ("provider", "fournisseur", "gitlab-provider", "cover_provider", "installux")
NON_PROVIDER_HINTS = ("hasp", "rus_cover", "licence", "license", "cover_install")

# =====================================================
# GESTION DE LA CONVERSATION STATIQUE
# =====================================================

def build_default_state() -> dict:
    return {
        "static_conversation_active": False,
        "static_conversation_step": 0,
        "selected_brand": None,
        "current_static_scenario": None,
        "pending_version": None,
        "pending_brands": [],
        "last_version": None,
        "last_brand": None,
        "pending_provider": None,
        "pending_provider_brands": [],
        "last_provider": None,
        "last_action": None,
        "last_action_brand": None,
        "messages": [],
        "current_conversation_id": None,
        "images_cache": {},
        "awaiting_install_version": False,
        "pending_install_brand": None,
        "awaiting_provider_offer": False,
        "awaiting_provider_version": False,
        "pending_provider_brand": None,
    }

# =====================================================
# GOOGLE DRIVE — TÉLÉCHARGEMENT DES DOCS
# =====================================================

def _download_file_from_drive(file_id: str, dest_path: str, api_key: str = "") -> bool:
    session = requests.Session()

    if api_key:
        url_api = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media&key={api_key}"
        try:
            r = session.get(url_api, timeout=60, stream=True)
            if r.status_code == 200:
                with open(dest_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
                return True
        except Exception:
            pass

    import re as _re
    url_public = f"https://drive.google.com/uc?export=download&id={file_id}"
    try:
        r = session.get(url_public, timeout=60, stream=True)
        content_type = r.headers.get("Content-Type", "")
        if "text/html" in content_type:
            confirm_token = None
            for key, value in r.cookies.items():
                if key.startswith("download_warning"):
                    confirm_token = value
                    break
            if not confirm_token:
                match = _re.search(r'confirm=([0-9A-Za-z_\-]+)', r.text)
                if match:
                    confirm_token = match.group(1)
            if not confirm_token:
                match = _re.search(r'"([^"]+)"\s*,\s*"download_warning"', r.text)
                if match:
                    confirm_token = match.group(1)
            url_confirm = (
                f"https://drive.google.com/uc?export=download&confirm={confirm_token}&id={file_id}"
                if confirm_token
                else f"https://drive.google.com/uc?export=download&confirm=t&id={file_id}"
            )
            r = session.get(url_confirm, timeout=120, stream=True)

        if r.status_code == 200 and "text/html" not in r.headers.get("Content-Type", ""):
            with open(dest_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True
    except Exception:
        pass

    url_alt = f"https://drive.usercontent.google.com/download?id={file_id}&export=download&authuser=0&confirm=t"
    try:
        r = session.get(url_alt, timeout=120, stream=True)
        if r.status_code == 200 and "text/html" not in r.headers.get("Content-Type", ""):
            with open(dest_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True
    except Exception:
        pass

    return False


def download_docs_from_drive(
    gdrive_folder_id: str = GDRIVE_FOLDER_ID,
    gdrive_api_key: str = "",
    docs_dir: str = DOCS_DIR,
) -> tuple[str, str, str]:
    if os.path.exists(docs_dir):
        shutil.rmtree(docs_dir)
    os.makedirs(docs_dir, exist_ok=True)

    errors: list[str] = []
    summary = ""

    try:
        api_url = "https://www.googleapis.com/drive/v3/files"
        params = {
            "q": f"'{gdrive_folder_id}' in parents and trashed=false",
            "fields": "files(id, name, mimeType)",
            "key": gdrive_api_key,
            "pageSize": 100,
        }
        resp = requests.get(api_url, params=params, timeout=30)
        resp.raise_for_status()
        files = resp.json().get("files", [])

        if not files:
            return docs_dir, "", (
                "⚠️ Aucun fichier trouvé dans le dossier Drive.\n"
                f"Folder ID : {gdrive_folder_id}"
            )

        downloaded = 0
        skipped = 0

        for f in files:
            file_id = f["id"]
            file_name = f["name"]
            mime = f.get("mimeType", "")

            if mime in ("application/vnd.google-apps.folder",) or mime.startswith("application/vnd.google-apps"):
                skipped += 1
                continue

            dest = os.path.join(docs_dir, file_name)
            if _download_file_from_drive(file_id, dest, api_key=gdrive_api_key):
                downloaded += 1
            else:
                errors.append(f"❌ {file_name} — impossible de télécharger.")

        summary = f"✅ {downloaded} fichier(s) téléchargé(s)"
        if skipped:
            summary += f", {skipped} ignoré(s)"
        if errors:
            summary += f", {len(errors)} erreur(s)"

        error_message = "\n\n".join(errors) if errors else ""

    except requests.exceptions.HTTPError as http_err:
        status = http_err.response.status_code if http_err.response else "?"
        error_message = f"❌ Erreur HTTP {status} : {http_err}"
        summary = ""
    except Exception as e:
        error_message = f"❌ Erreur inattendue : {e}"
        summary = ""

    return docs_dir, summary, error_message

# =====================================================
# CHARGEMENT EXCEL
# =====================================================

def _is_excel_file(file_name: str) -> bool:
    return file_name.lower().endswith((".xlsx", ".xls"))


def _iter_excel_paths(directory_path: str) -> list[tuple[str, str]]:
    if not os.path.exists(directory_path):
        return []
    return [
        (file_name, os.path.join(directory_path, file_name))
        for file_name in os.listdir(directory_path)
        if _is_excel_file(file_name)
    ]


def _read_excel_workbook(file_path: str) -> dict[str, pd.DataFrame]:
    errors: list[str] = []
    for engine in (None, "openpyxl", "xlrd"):
        try:
            kwargs = {"sheet_name": None}
            if engine:
                kwargs["engine"] = engine
            workbook = pd.read_excel(file_path, **kwargs)
            if isinstance(workbook, dict):
                return workbook
        except Exception as exc:
            errors.append(f"{engine or 'auto'}: {exc}")
    raise RuntimeError(f"Impossible de lire {os.path.basename(file_path)} ({'; '.join(errors)})")


def _normalize_url(url: str) -> str:
    return url.strip().strip("`'\"[](){}<>.,;")


def _extract_urls_from_text(text: str) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for raw_url in URL_REGEX.findall(text):
        cleaned = _normalize_url(raw_url)
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            urls.append(cleaned)
    return urls


def _pick_binary_url(urls: list[str], preferred_token: str = "") -> str | None:
    if not urls:
        return None

    def _is_binary_link(url: str) -> bool:
        lower_url = url.lower()
        return any(ext in lower_url for ext in (".exe", ".zip", ".msi", ".rar"))

    binary_urls = [url for url in urls if _is_binary_link(url)]
    candidates = binary_urls or urls

    if preferred_token:
        preferred_compact = re.sub(r"\D", "", preferred_token)
        for candidate in candidates:
            if preferred_token in candidate:
                return candidate
            if preferred_compact and preferred_compact in re.sub(r"\D", "", candidate):
                return candidate

    return candidates[0]


def _text_has_version(text: str, version_number: str) -> bool:
    compact_version = version_number.replace(".", "")
    compact_text = re.sub(r"\D", "", text)
    return version_number in text or (compact_version and compact_version in compact_text)


def _provider_number_matches(text: str, provider_number: str) -> bool:
    escaped_number = re.escape(provider_number)
    loose_number = escaped_number.replace(r"\.", r"[._-]?")
    dotted_pattern = re.compile(rf"(?<!\d)(?:v)?{loose_number}(?!\d)", re.IGNORECASE)
    if dotted_pattern.search(text):
        return True
    compact_provider = re.sub(r"\D", "", provider_number)
    compact_text = re.sub(r"\D", "", text)
    return bool(compact_provider) and compact_provider in compact_text


def _is_provider_url(url: str, row_text: str) -> bool:
    haystack = f"{url} {row_text}".lower()
    if any(hint in haystack for hint in NON_PROVIDER_HINTS):
        return False
    if any(hint in haystack for hint in PROVIDER_HINTS):
        return True
    return not bool(VERSION_REGEX.search(url))


def _extract_hidden_inputs(html_content: str) -> dict[str, str]:
    hidden_inputs: dict[str, str] = {}
    hidden_pattern = re.compile(r'<input[^>]*type=["\']hidden["\'][^>]*>', re.IGNORECASE)
    name_pattern = re.compile(r'name=["\']([^"\']+)["\']', re.IGNORECASE)
    value_pattern = re.compile(r'value=["\']([^"\']*)["\']', re.IGNORECASE)

    for input_tag in hidden_pattern.findall(html_content):
        name_match = name_pattern.search(input_tag)
        if not name_match:
            continue
        value_match = value_pattern.search(input_tag)
        hidden_inputs[name_match.group(1)] = value_match.group(1) if value_match else ""
    return hidden_inputs


def _html_to_text(html_content: str) -> str:
    stripped = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", html_content)
    stripped = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", stripped)
    stripped = re.sub(r"(?s)<[^>]+>", " ", stripped)
    stripped = html.unescape(stripped)
    return re.sub(r"\s+", " ", stripped).strip()


def _extract_internal_links(html_content: str, current_url: str, allowed_host: str) -> list[str]:
    links: list[str] = []
    seen: set[str] = set()
    for href in re.findall(r'href=["\']([^"\']+)["\']', html_content, re.IGNORECASE):
        if not href:
            continue
        lowered = href.lower()
        if lowered.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        absolute = urljoin(current_url, href)
        parsed = urlparse(absolute)
        if parsed.netloc != allowed_host:
            continue
        if parsed.path.startswith(("/login", "/account", "/api/auth", "/logout")):
            continue
        cleaned = parsed._replace(fragment="").geturl()
        if cleaned not in seen:
            seen.add(cleaned)
            links.append(cleaned)
    return links


# =====================================================
# ELIUM — GRAPHQL
# =====================================================

ELIUM_SEARCH_QUERY = """
query SearchByPrompt($query: StorySearchQuery!, $recordAnalytics: Boolean!) {
  me {
    search(query: $query, recordAnalytics: $recordAnalytics) {
      totalCount
      suggestedText
      stories {
        highlightedSnippets
        story {
          id
          slug
          space { id name slug }
          version {
            id
            title
            excerpt {
              __typename
              ... on SlateRichContent { text }
            }
            builtins {
              key type
              value {
                __typename
                ... on StringWrapper { valueString }
                ... on StringListWrapper { valueStringList }
                ... on IntWrapper { valueInt }
                ... on BooleanWrapper { valueBoolean }
                ... on DatetimeWrapper { valueDatetime }
                ... on JsonWrapper { valueJson }
                ... on User { id name slug }
                ... on Tag { id name }
                ... on TagListWrapper { valueTagList { id name } }
              }
            }
          }
        }
      }
    }
  }
}
"""


def _normalize_elium_base_url(base_url: str) -> str:
    normalized_base = base_url.strip().rstrip("/")
    if not normalized_base:
        return ""
    parsed = urlparse(normalized_base)
    if not parsed.scheme:
        normalized_base = f"https://{normalized_base}"
        parsed = urlparse(normalized_base)
    if not parsed.netloc:
        return ""
    return normalized_base


def _elium_headers() -> dict[str, str]:
    return {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "X-Elium-Device": "WEB",
        "X-Elium-Version": "1.118.9",
    }


def _clean_elium_snippet(snippet: str) -> str:
    if not snippet:
        return ""
    cleaned = re.sub(r"<em[^>]*>", "", snippet)
    cleaned = cleaned.replace("</em>", "")
    cleaned = re.sub(r"(?is)<[^>]+>", " ", cleaned)
    cleaned = html.unescape(cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def _create_elium_authenticated_session(
    normalized_base: str,
    login_email: str,
    login_password: str,
    timeout: int = 30,
) -> tuple[requests.Session | None, str]:
    session = requests.Session()
    try:
        login_page_response = session.get(f"{normalized_base}/login", timeout=timeout, allow_redirects=True)
        hidden_inputs = _extract_hidden_inputs(login_page_response.text or "")
        payload = {
            **hidden_inputs,
            "login": login_email,
            "password": login_password,
            "login_submit": hidden_inputs.get("login_submit", "Submit"),
            "forward_url": hidden_inputs.get("forward_url", normalized_base + "/"),
        }
        auth_response = session.post(f"{normalized_base}/login", data=payload, timeout=timeout, allow_redirects=True)
        if "/login" in auth_response.url:
            return None, "Échec login Elium (identifiants invalides ou SSO requis)"
        return session, "Login Elium OK"
    except Exception as exc:
        return None, f"Erreur login Elium: {exc}"


def check_elium_graphql_access(
    base_url: str,
    login_email: str,
    login_password: str,
    timeout: int = 30,
) -> tuple[bool, str]:
    normalized_base = _normalize_elium_base_url(base_url)
    if not normalized_base or not login_email or not login_password:
        return False, "Elium désactivé (URL/email/password manquants)"

    session, login_debug = _create_elium_authenticated_session(normalized_base, login_email, login_password, timeout)
    if session is None:
        return False, login_debug

    try:
        probe_query = "query HealthProbe { me { id } }"
        probe_response = session.post(
            f"{normalized_base}/graphql",
            headers=_elium_headers(),
            json={"query": probe_query, "variables": {}},
            timeout=timeout,
        )
        if probe_response.status_code != 200:
            return False, f"{login_debug} | GraphQL HTTP {probe_response.status_code}"

        payload = probe_response.json()
        if payload.get("errors"):
            return False, f"{login_debug} | GraphQL errors: {payload.get('errors')[:1]}"

        me_id = (((payload.get("data") or {}).get("me") or {}).get("id") or "").strip()
        if not me_id:
            return False, f"{login_debug} | GraphQL sans me.id"
        return True, f"{login_debug} | GraphQL OK"
    except Exception as exc:
        return False, f"{login_debug} | Erreur GraphQL: {exc}"


# =====================================================
# GÉNÉRATION DE RÉPONSE AVEC CONTEXTE
# =====================================================

def answer_with_context_documents(
    prompt: str,
    documents: list,
    api_key: str,
    max_context_chars: int = 14000,
    conversation_history: list = None,
) -> str:
    from langchain_groq import ChatGroq
    from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

    seen_contents: set[str] = set()
    unique_documents = []
    for doc in documents:
        key = doc.page_content[:150].strip()
        if key not in seen_contents:
            seen_contents.add(key)
            unique_documents.append(doc)
    documents = unique_documents

    if not documents:
        return (
            "❌ Je n'ai trouvé aucun article correspondant dans la base de connaissances.\n\n"
            "Essayez de reformuler votre question ou contactez le support Cover directement."
        )
    if not api_key:
        return "⚠️ GROQ_API_KEY manquante pour générer la réponse."

    context_chunks = []
    used_chars = 0
    for idx, doc in enumerate(documents, start=1):
        source = str(doc.metadata.get("source", ""))
        title = str(doc.metadata.get("title", "")) or f"Document {idx}"
        block = (
            f"=== ARTICLE {idx} ===\n"
            f"TITRE: {title}\n"
            f"SOURCE: {source}\n"
            f"CONTENU:\n{doc.page_content.strip()}"
        )
        if used_chars + len(block) > max_context_chars:
            remaining = max_context_chars - used_chars
            if remaining <= 0:
                break
            block = block[:remaining]
        context_chunks.append(block)
        used_chars += len(block)
        if used_chars >= max_context_chars:
            break

    context_text = "\n\n".join(context_chunks).strip()

    llm = ChatGroq(
        groq_api_key=api_key,
        model_name="llama-3.1-8b-instant",
        temperature=0.1,
    )

    system_prompt = (
        "Tu es un assistant support technique expert pour le logiciel Cover "
        "(logiciel de gestion de menuiserie/fermeture).\n"
        "Tu aides les techniciens, revendeurs et utilisateurs finaux.\n\n"
        "=== RÈGLES ABSOLUES — NE JAMAIS ENFREINDRE ===\n"
        "1. BASE-TOI UNIQUEMENT sur les articles fournis dans le contexte ci-dessous.\n"
        "2. Si la réponse n'est PAS dans le contexte, réponds EXACTEMENT cette phrase et rien d'autre :\n"
        "   'Je n\\'ai pas trouvé cette information dans la base de connaissances Cover. Contactez le support.'\n"
        "   → NE JAMAIS inventer, suggérer ou déduire une procédure absente du contexte.\n"
        "   → NE JAMAIS dire 'je vous recommande de vérifier...' ou proposer des étapes génériques.\n"
        "3. Si un article contient une PROCÉDURE (étapes numérotées), reproduis-la INTÉGRALEMENT et dans l'ordre.\n"
        "4. Reproduis EXACTEMENT les valeurs techniques (chemins, noms de tables, requêtes SQL, codes erreur).\n"
        "5. NE JAMAIS répéter deux fois la même information dans ta réponse.\n"
        "6. NE JAMAIS citer plusieurs articles qui disent la même chose — choisis le plus complet.\n"
        "7. Tiens compte de l'historique de conversation pour comprendre le contexte.\n\n"
        "=== FORMAT OBLIGATOIRE ===\n"
        "- Toujours en FRANÇAIS.\n"
        "- Un seul titre ## si pertinent.\n"
        "- Listes numérotées pour les étapes (une seule fois, pas de répétition).\n"
        "- **Gras** pour les termes techniques importants.\n"
        "- ``` pour les commandes/chemins/valeurs SQL.\n"
        "- UNE seule ligne source à la fin : *📖 Source : [titre de l'article]*\n"
        "- Réponse concise et directe — pas de remplissage, pas de phrases de politesse inutiles.\n"
    )

    messages_to_send = [SystemMessage(content=system_prompt)]

    if conversation_history:
        for msg in conversation_history[-6:]:
            role = msg.get("role", "")
            content = str(msg.get("content", "")).strip()
            if not content:
                continue
            if role == "user":
                messages_to_send.append(HumanMessage(content=content))
            elif role == "assistant":
                messages_to_send.append(AIMessage(content=content))

    user_message = (
        f"QUESTION : {prompt.strip()}\n\n"
        f"=== CONTEXTE — Articles de la base de connaissances Cover ===\n\n"
        f"{context_text}\n\n"
        "RAPPEL : Réponds UNIQUEMENT à partir de ces articles. "
        "Si l'information n'est pas dans le contexte, dis-le clairement sans inventer. "
        "Ne répète pas la même information deux fois."
    )
    messages_to_send.append(HumanMessage(content=user_message))

    try:
        response = llm.invoke(messages_to_send)
    except Exception:
        try:
            response = llm.invoke([SystemMessage(content=system_prompt), HumanMessage(content=user_message)])
        except Exception as e2:
            return f"⚠️ Erreur lors de la génération de la réponse : {e2}"

    if isinstance(response, str):
        return response.strip()
    content = getattr(response, "content", "")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        merged = []
        for item in content:
            if isinstance(item, str):
                merged.append(item)
            elif isinstance(item, dict) and "text" in item:
                merged.append(str(item.get("text")))
        return "\n".join([p for p in merged if p.strip()]).strip()
    return str(content).strip()


def answer_with_context_documents_stream(
    prompt: str,
    documents: list,
    api_key: str,
    max_context_chars: int = 14000,
    conversation_history: list = None,
):
    """
    Générateur qui stream la réponse token par token via ChatGroq.
    Yields des str (chunks de texte).
    """
    from langchain_groq import ChatGroq
    from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

    seen_contents: set[str] = set()
    unique_documents = []
    for doc in documents:
        key = doc.page_content[:150].strip()
        if key not in seen_contents:
            seen_contents.add(key)
            unique_documents.append(doc)
    documents = unique_documents

    if not documents:
        yield (
            "❌ Je n'ai trouvé aucun article correspondant dans la base de connaissances.\n\n"
            "Essayez de reformuler votre question ou contactez le support Cover directement."
        )
        return
    if not api_key:
        yield "⚠️ GROQ_API_KEY manquante pour générer la réponse."
        return

    context_chunks = []
    used_chars = 0
    for idx, doc in enumerate(documents, start=1):
        source = str(doc.metadata.get("source", ""))
        title = str(doc.metadata.get("title", "")) or f"Document {idx}"
        block = (
            f"=== ARTICLE {idx} ===\n"
            f"TITRE: {title}\n"
            f"SOURCE: {source}\n"
            f"CONTENU:\n{doc.page_content.strip()}"
        )
        if used_chars + len(block) > max_context_chars:
            remaining = max_context_chars - used_chars
            if remaining <= 0:
                break
            block = block[:remaining]
        context_chunks.append(block)
        used_chars += len(block)
        if used_chars >= max_context_chars:
            break

    context_text = "\n\n".join(context_chunks).strip()

    llm = ChatGroq(
        groq_api_key=api_key,
        model_name="llama-3.1-8b-instant",
        temperature=0.1,
        streaming=True,
    )

    system_prompt = (
        "Tu es un assistant support technique expert pour le logiciel Cover "
        "(logiciel de gestion de menuiserie/fermeture).\n"
        "Tu aides les techniciens, revendeurs et utilisateurs finaux.\n\n"
        "=== RÈGLES ABSOLUES — NE JAMAIS ENFREINDRE ===\n"
        "1. BASE-TOI UNIQUEMENT sur les articles fournis dans le contexte ci-dessous.\n"
        "2. Si la réponse n'est PAS dans le contexte, réponds EXACTEMENT cette phrase et rien d'autre :\n"
        "   'Je n\\'ai pas trouvé cette information dans la base de connaissances Cover. Contactez le support.'\n"
        "3. Si un article contient une PROCÉDURE (étapes numérotées), reproduis-la INTÉGRALEMENT et dans l'ordre.\n"
        "4. Reproduis EXACTEMENT les valeurs techniques (chemins, noms de tables, requêtes SQL, codes erreur).\n"
        "5. NE JAMAIS répéter deux fois la même information dans ta réponse.\n"
        "6. NE JAMAIS citer plusieurs articles qui disent la même chose — choisis le plus complet.\n"
        "7. Tiens compte de l'historique de conversation pour comprendre le contexte.\n\n"
        "=== FORMAT OBLIGATOIRE ===\n"
        "- Toujours en FRANÇAIS.\n"
        "- Un seul titre ## si pertinent.\n"
        "- Listes numérotées pour les étapes (une seule fois, pas de répétition).\n"
        "- **Gras** pour les termes techniques importants.\n"
        "- ``` pour les commandes/chemins/valeurs SQL.\n"
        "- UNE seule ligne source à la fin : *📖 Source : [titre de l'article]*\n"
        "- Réponse concise et directe — pas de remplissage, pas de phrases de politesse inutiles.\n"
    )

    messages_to_send = [SystemMessage(content=system_prompt)]

    if conversation_history:
        for msg in conversation_history[-6:]:
            role = msg.get("role", "")
            content = str(msg.get("content", "")).strip()
            if not content:
                continue
            if role == "user":
                messages_to_send.append(HumanMessage(content=content))
            elif role == "assistant":
                messages_to_send.append(AIMessage(content=content))

    user_message = (
        f"QUESTION : {prompt.strip()}\n\n"
        f"=== CONTEXTE — Articles de la base de connaissances Cover ===\n\n"
        f"{context_text}\n\n"
        "RAPPEL : Réponds UNIQUEMENT à partir de ces articles. "
        "Si l'information n'est pas dans le contexte, dis-le clairement sans inventer. "
        "Ne répète pas la même information deux fois."
    )
    messages_to_send.append(HumanMessage(content=user_message))

    try:
        for chunk in llm.stream(messages_to_send):
            text = getattr(chunk, "content", "")
            if text:
                yield text
    except Exception as e:
        yield f"\n\n⚠️ Erreur streaming : {e}"


# =====================================================
# EMBEDDINGS & SIMILARITÉ
# =====================================================

def compute_embedding_similarity(query: str, documents: list[Document]) -> list[tuple[float, Document]]:
    embed_model = get_embed_model()
    query_embedding = embed_model.embed_query(query)
    scored = []
    for doc in documents:
        doc_embedding = embed_model.embed_query(doc.page_content)
        similarity = cosine_similarity([query_embedding], [doc_embedding])[0][0]
        scored.append((similarity, doc))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored


# =====================================================
# RECHERCHE ELIUM — AMÉLIORÉE
# =====================================================

def search_elium_documents(
    base_url: str,
    login_email: str,
    login_password: str,
    prompt: str,
    max_results: int = 6,
    timeout: int = 30,
) -> tuple[list, str]:
    normalized_base = _normalize_elium_base_url(base_url)
    if not normalized_base or not login_email or not login_password:
        return [], "Elium désactivé"

    prompt_text = prompt.strip()
    if not prompt_text:
        return [], "Prompt Elium vide"

    session, login_debug = _create_elium_authenticated_session(normalized_base, login_email, login_password, timeout)
    if session is None:
        return [], login_debug

    try:
        variables = {"query": {"text": prompt_text}, "recordAnalytics": False}
        response = session.post(
            f"{normalized_base}/graphql",
            headers=_elium_headers(),
            json={"query": ELIUM_SEARCH_QUERY, "variables": variables},
            timeout=timeout,
        )
        if response.status_code != 200:
            return [], f"{login_debug} | GraphQL HTTP {response.status_code}"

        payload = response.json()
        if payload.get("errors"):
            return [], f"{login_debug} | GraphQL errors: {payload.get('errors')[:1]}"

        stories = (((payload.get("data") or {}).get("me") or {}).get("search") or {}).get("stories") or []
        if not stories:
            return [], f"{login_debug} | 0 résultats"

        raw_documents = []
        for story_result in stories[:20]:
            story = story_result.get("story") or {}
            version = story.get("version") or {}
            space = story.get("space") or {}

            story_slug = str(story.get("slug") or "").strip()
            space_slug = str(space.get("slug") or "").strip()
            title = str(version.get("title") or "").strip() or "Article Elium"
            excerpt_text = str((version.get("excerpt") or {}).get("text") or "").strip()
            clean_highlights = [
                _clean_elium_snippet(str(s))
                for s in (story_result.get("highlightedSnippets") or [])
                if str(s).strip()
            ]

            content_parts = [title]
            if clean_highlights:
                content_parts.extend(clean_highlights)
            if excerpt_text:
                content_parts.append(excerpt_text)

            page_content = " | ".join(content_parts).strip()
            story_url = (
                f"{normalized_base}/{space_slug}/{story_slug}" if space_slug and story_slug
                else f"{normalized_base}/{story_slug}" if story_slug
                else normalized_base
            )

            raw_documents.append({
                "doc": Document(
                    page_content=page_content[:30000],
                    metadata={"source": story_url, "kind": "elium_graphql", "title": title, "story_id": str(story.get("id") or "").strip()},
                ),
                "content": page_content,
            })

        if not raw_documents:
            return [], f"{login_debug} | Aucun document construit"

        embed_model = get_embed_model()
        query_embedding = embed_model.embed_query(prompt_text)
        scored_docs = []
        for item in raw_documents:
            doc_embedding = embed_model.embed_query(item["content"])
            similarity = cosine_similarity([query_embedding], [doc_embedding])[0][0]
            scored_docs.append((similarity, item["doc"]))
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        final_docs = [doc for _, doc in scored_docs[:max_results]]

        return final_docs, f"{login_debug} | reranked={len(final_docs)}"

    except Exception as exc:
        return [], f"{login_debug} | Erreur: {exc}"


def load_elium_documents(
    base_url: str,
    login_email: str,
    login_password: str,
    max_pages: int = 80,
    timeout: int = 30,
) -> tuple[list[Document], str]:
    is_ok, health_debug = check_elium_graphql_access(base_url, login_email, login_password, timeout)
    if not is_ok:
        return [], health_debug

    seed_queries = ["cover", "session", "manager", "provider", "version"]
    target_docs = max(1, min(max_pages, 60))
    per_query = max(2, target_docs // len(seed_queries))

    all_docs: list[Document] = []
    seen_story_ids: set[str] = set()
    for seed in seed_queries:
        docs, _ = search_elium_documents(base_url, login_email, login_password, seed, per_query, timeout)
        for doc in docs:
            story_id = str(doc.metadata.get("story_id", "")).strip()
            if story_id and story_id in seen_story_ids:
                continue
            if story_id:
                seen_story_ids.add(story_id)
            all_docs.append(doc)
            if len(all_docs) >= target_docs:
                break
        if len(all_docs) >= target_docs:
            break

    return all_docs, f"{health_debug} | Elium pré-indexés: {len(all_docs)}"


# =====================================================
# CHARGEMENT EXCEL
# =====================================================

def load_excel_files(directory_path: str) -> list[Document]:
    documents = []
    for file_name, file_path in _iter_excel_paths(directory_path):
        try:
            excel_data = _read_excel_workbook(file_path)
        except Exception as exc:
            print(f"Erreur lecture Excel ({file_name}): {exc}")
            continue

        for sheet_name, df in excel_data.items():
            df = df.fillna("").astype(str)
            for idx, row in df.iterrows():
                row_text = []
                version_found = None
                url_found = None

                for col_name, value in row.items():
                    value_str = str(value)
                    versions = VERSION_REGEX.findall(value_str)
                    if versions:
                        version_found = versions[0]
                        row_text.append(f"VERSION: {versions[0]}")
                    urls = _extract_urls_from_text(value_str)
                    if urls:
                        url_found = urls[0]
                        row_text.append(f"URL: {urls[0]}")
                    if value_str and value_str != "nan":
                        row_text.append(f"{col_name}: {value_str}")

                if version_found or url_found:
                    enhanced_text = (
                        f"\nMARQUE: {sheet_name}\nLIGNE: {idx + 2}\n"
                        f"VERSION: {version_found or 'NON TROUVEE'}\n"
                        f"URL: {url_found or 'NON TROUVEE'}\n"
                        f"DONNEES_COMPLETES: {' | '.join(row_text)}\n"
                    )
                else:
                    enhanced_text = (
                        f"\nMARQUE: {sheet_name}\nLIGNE: {idx + 2}\n"
                        f"DONNEES: {' | '.join(row_text)}\n"
                    )

                documents.append(Document(
                    page_content=enhanced_text,
                    metadata={"source": file_name, "sheet": sheet_name, "version": version_found or "", "url": url_found or "", "row": idx + 2},
                ))
    return documents


# =====================================================
# RECHERCHE VERSIONS / PROVIDERS DANS LES EXCELS
# =====================================================

def get_all_brands(docs_dir: str = DOCS_DIR) -> list[str]:
    brands: set[str] = set()
    if not os.path.exists(docs_dir):
        return []
    for _, file_path in _iter_excel_paths(docs_dir):
        try:
            excel_data = _read_excel_workbook(file_path)
            for sheet_name in excel_data.keys():
                brands.add(sheet_name.lower())
        except Exception:
            pass
    return list(brands)


def get_versions_with_urls(brand_name: str, docs_dir: str = DOCS_DIR) -> list[dict]:
    results = []
    if not os.path.exists(docs_dir):
        return []
    for _, file_path in _iter_excel_paths(docs_dir):
        try:
            excel_data = _read_excel_workbook(file_path)
        except Exception:
            continue
        for sheet_name, df in excel_data.items():
            if sheet_name.lower() != brand_name.lower():
                continue
            df = df.fillna("").astype(str)
            for _, row in df.iterrows():
                row_text = " ".join(str(v) for v in row.values)
                versions = VERSION_REGEX.findall(row_text)
                urls = _extract_urls_from_text(row_text)
                for version in versions:
                    matched_url = "NON TROUVEE"
                    for url in urls:
                        if version in url:
                            matched_url = url
                            break
                    if matched_url == "NON TROUVEE" and len(urls) == 1:
                        matched_url = urls[0]
                    results.append({"version": version, "url": matched_url})

    seen: set[tuple] = set()
    unique = []
    for r in results:
        key = (r["version"], r["url"])
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique


def search_all_versions(version_number: str, specific_brand: str | None = None, docs_dir: str = DOCS_DIR) -> list[dict]:
    results = []
    if not os.path.exists(docs_dir):
        return results

    for _, file_path in _iter_excel_paths(docs_dir):
        try:
            excel_data = _read_excel_workbook(file_path)
        except Exception:
            continue
        for sheet_name, df in excel_data.items():
            if specific_brand and sheet_name.lower() != specific_brand.lower():
                continue
            df = df.fillna("").astype(str)
            for _, row in df.iterrows():
                row_text = " ".join(str(v) for v in row.values)
                if not _text_has_version(row_text, version_number):
                    continue
                urls = _extract_urls_from_text(row_text)
                url_found = _pick_binary_url(urls, preferred_token=version_number)
                if url_found:
                    results.append({"marque": sheet_name, "url": url_found})

    seen: set[tuple] = set()
    unique = []
    for r in results:
        key = (r["marque"], r["url"])
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique


def get_direct_response(version: str, results: list[dict]) -> str:
    if not results:
        return f"Aucune URL trouvée pour {version}"
    seen: set[tuple] = set()
    unique = []
    for r in results:
        key = (r["marque"], r["url"])
        if key not in seen:
            seen.add(key)
            unique.append(r)
    if len(unique) == 1:
        return unique[0]["url"]
    return "\n".join(f"{r['marque']}: {r['url']}" for r in unique)


def format_versions_response(brand_name: str, results_versions: list[dict]) -> str:
    if not results_versions:
        return f"Aucune version trouvée pour **{brand_name}**."
    lines = [f"### 📋 Versions disponibles pour **{brand_name}** :"]
    for item in results_versions:
        version_value = item.get("version", "")
        url_value = item.get("url", "NON TROUVEE")
        lines.append(f"- {version_value} : {url_value}" if url_value != "NON TROUVEE" else f"- {version_value} : URL NON TROUVEE")
    return "\n".join(lines)


def get_providers_with_urls(brand_name: str, docs_dir: str = DOCS_DIR) -> list[dict]:
    results = []
    if not os.path.exists(docs_dir):
        return []
    for _, file_path in _iter_excel_paths(docs_dir):
        try:
            excel_data = _read_excel_workbook(file_path)
        except Exception:
            continue
        for sheet_name, df in excel_data.items():
            if sheet_name.lower() != brand_name.lower():
                continue
            df = df.fillna("").astype(str)
            for _, row in df.iterrows():
                row_text = " ".join(str(v) for v in row.values)
                urls = _extract_urls_from_text(row_text)
                for url in urls:
                    if _is_provider_url(url, row_text):
                        results.append({"url": url})

    seen: set[str] = set()
    unique = []
    for r in results:
        if r["url"] not in seen:
            seen.add(r["url"])
            unique.append(r)
    return unique


def format_providers_response(brand_name: str, results: list[dict]) -> str:
    if not results:
        return f"Aucun provider trouvé pour **{brand_name}**."
    lines = [f"### 📋 Providers disponibles pour **{brand_name}** :"]
    for item in results:
        lines.append(f"- {item['url']}")
    return "\n".join(lines)


def search_all_providers_by_number(provider_number: str, specific_brand: str | None = None, docs_dir: str = DOCS_DIR) -> list[dict]:
    results = []
    if not os.path.exists(docs_dir):
        return results

    provider_number_str = str(provider_number)

    for _, file_path in _iter_excel_paths(docs_dir):
        try:
            excel_data = _read_excel_workbook(file_path)
        except Exception:
            continue
        for sheet_name, df in excel_data.items():
            if specific_brand and sheet_name.lower() != specific_brand.lower():
                continue
            df = df.fillna("").astype(str)
            for _, row in df.iterrows():
                row_text = " ".join(str(v) for v in row.values)
                urls = _extract_urls_from_text(row_text)
                for url in urls:
                    if _provider_number_matches(url, provider_number_str) and _is_provider_url(url, row_text):
                        results.append({"marque": sheet_name, "provider_number": provider_number_str, "url": url})
                if urls and _provider_number_matches(row_text, provider_number_str):
                    if not any(_provider_number_matches(url, provider_number_str) for url in urls):
                        fallback_url = _pick_binary_url(
                            [url for url in urls if _is_provider_url(url, row_text)],
                            preferred_token=provider_number_str,
                        )
                        if fallback_url:
                            results.append({"marque": sheet_name, "provider_number": provider_number_str, "url": fallback_url})

    seen: set[tuple] = set()
    unique = []
    for r in results:
        key = (r["marque"], r["url"])
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique


def get_provider_number_response(provider_number: str, results: list[dict]) -> str:
    if not results:
        return f"Aucune URL trouvée pour le provider {provider_number}"
    seen: set[tuple] = set()
    unique = []
    for r in results:
        key = (r["marque"], r["url"])
        if key not in seen:
            seen.add(key)
            unique.append(r)
    if len(unique) == 1:
        return unique[0]["url"]
    return "\n".join(f"{r['marque']}: {r['url']}" for r in unique)


# =====================================================
# REQUÊTES CHAÎNÉES
# =====================================================

def detect_chained_request(prompt: str, docs_dir: str = DOCS_DIR) -> str | None:
    prompt_lower = prompt.lower().strip()
    chained_patterns = [
        r"^et aussi pour (.+)$",
        r"^et pour (.+)$",
        r"^aussi pour (.+)$",
        r"^aussi (.+)$",
        r"^et (.+)\??$",
        r"^pour (.+) aussi$",
        r"^et (.+) aussi$",
        r"^(.+) aussi$",
        r"^et (.+) également$",
        r"^(.+) également$",
    ]
    for pattern in chained_patterns:
        match = re.match(pattern, prompt_lower)
        if match:
            candidate = match.group(1).strip().rstrip("?").strip()
            brands = get_all_brands(docs_dir)
            for brand in brands:
                if brand.lower() == candidate.lower() or candidate.lower() in brand.lower() or brand.lower() in candidate.lower():
                    return brand
    return None


# =====================================================
# EXTRACTION D'IMAGES PDF — FILTRE STRICT PAR SOURCE
# =====================================================

def _image_hash(image_bytes: bytes) -> str:
    return hashlib.md5(image_bytes).hexdigest()


def _estimate_requested_image_count(question_text: str, llm_answer: str = "") -> int:
    numbered_items = len(re.findall(r"(?m)^\s*\d+[\).:-]\s+\S+", question_text))
    bulleted_items = len(re.findall(r"(?m)^\s*[-*•]\s+\S+", question_text))
    answer_items = len(re.findall(r"(?m)^\s*(?:\d+[\).:-]|[-*•])\s+\S+", llm_answer))
    split_parts = [
        part.strip()
        for part in re.split(r"(?:\n+|;| et aussi | puis | également | aussi | et )", question_text.lower())
    ]
    split_items = len([part for part in split_parts if len(part.split()) >= 3])
    estimated = max(numbered_items, bulleted_items, split_items, 1)
    if answer_items > 1:
        estimated = max(estimated, min(answer_items, MAX_IMAGES_PER_RESPONSE))
    return min(max(estimated, 1), MAX_IMAGES_PER_RESPONSE)


def _build_relevance_keywords(question_text: str, llm_answer: str = "") -> list[str]:
    STOP_WORDS = {
        "les", "des", "une", "pour", "dans", "sur", "avec", "par", "que",
        "qui", "est", "sont", "vous", "votre", "voici", "comment", "faire",
        "the", "and", "for", "with", "that", "this", "from", "have",
        "peut", "plus", "être", "tout", "aussi", "comme", "puis", "donc",
        "très", "bien", "alors", "après", "avant", "sous", "lors", "même",
        "cette", "cela", "ceci", "mais", "depuis", "vers", "entre",
    }
    q_words = re.findall(r"[a-zàâäéèêëîïôùûüç]{4,}", question_text.lower())
    q_kw = [w for w in q_words if w not in STOP_WORDS]

    a_words = re.findall(r"[a-zàâäéèêëîïôùûüç]{5,}", llm_answer.lower())
    a_kw = [w for w in a_words if w not in STOP_WORDS]
    a_counts = Counter(a_kw)
    a_top = [w for w, c in a_counts.most_common(10) if c >= 2]

    all_kw = list(dict.fromkeys(q_kw + a_top))[:15]
    return all_kw


def extract_relevant_images_from_pdf(
    pdf_path: str,
    page_numbers: list[int],
    question_text: str,
    llm_answer: str = "",
    seen_hashes: set | None = None,
    current_count: int = 0,
    max_images_per_response: int = MAX_IMAGES_PER_RESPONSE,
    max_images_for_pdf: int = 1,
    min_relevance_score: float = 0.45,
    precomputed_keywords: list[str] | None = None,
) -> list[bytes]:
    if seen_hashes is None:
        seen_hashes = set()
    extracted_images: list[bytes] = []
    if current_count >= max_images_per_response or max_images_for_pdf <= 0:
        return extracted_images

    all_kw = precomputed_keywords if precomputed_keywords is not None else _build_relevance_keywords(question_text, llm_answer)

    if len(all_kw) < 2:
        return []

    try:
        with fitz.open(pdf_path) as doc:
            unique_pages = sorted(set(page_numbers))
            scored_pages: list[tuple[float, int, int]] = []

            for page_num in unique_pages:
                if page_num < 0 or page_num >= len(doc):
                    continue
                page_text = doc[page_num].get_text("text").lower()
                matches = sum(1 for kw in all_kw if kw in page_text)
                score = matches / len(all_kw)

                if score >= min_relevance_score:
                    scored_pages.append((score, matches, page_num))

            if not scored_pages:
                return []

            scored_pages.sort(key=lambda row: (row[0], row[1]), reverse=True)
            remaining_capacity = max_images_per_response - current_count
            target_images = min(max_images_for_pdf, remaining_capacity)

            for _, _, page_num in scored_pages:
                if len(extracted_images) >= target_images:
                    break
                page = doc[page_num]

                page_text_check = page.get_text("text").lower()
                answer_kw = [w for w in _build_relevance_keywords("", llm_answer) if len(w) >= 5]
                answer_matches_on_page = sum(1 for kw in answer_kw[:8] if kw in page_text_check)
                if answer_kw and answer_matches_on_page == 0:
                    continue

                for img in page.get_images(full=True):
                    if current_count + len(extracted_images) >= max_images_per_response:
                        break
                    try:
                        xref = img[0]
                        base_image = doc.extract_image(xref)
                        image_bytes = base_image["image"]
                        h = _image_hash(image_bytes)
                        if h in seen_hashes:
                            continue
                        pil_img = Image.open(io.BytesIO(image_bytes))
                        width, height = pil_img.size
                        if width < 400 or height < 250:
                            continue
                        seen_hashes.add(h)
                        extracted_images.append(image_bytes)
                        break
                    except Exception:
                        continue
    except Exception as e:
        print(f"Erreur extraction images ({os.path.basename(pdf_path)}) : {e}")

    return extracted_images


def get_source_pages_from_documents(
    selected_docs: list[Document],
    docs_dir: str = DOCS_DIR,
) -> dict[str, list[int]]:
    sources: dict[str, list[int]] = {}
    for doc in selected_docs:
        src = doc.metadata.get("source", "")
        page = doc.metadata.get("page", None)

        if not str(src).lower().endswith(".pdf"):
            continue
        if page is None:
            continue

        candidates = [
            src,
            os.path.join(docs_dir, os.path.basename(src)),
            os.path.join(docs_dir, src),
            os.path.abspath(src),
            os.path.abspath(os.path.join(docs_dir, os.path.basename(src))),
        ]
        for candidate in candidates:
            if os.path.exists(candidate):
                sources.setdefault(candidate, []).append(int(page))
                break

    return sources


def get_source_pages_from_qa_response(qa_chain, prompt: str, docs_dir: str = DOCS_DIR) -> dict[str, list[int]]:
    sources: dict[str, list[int]] = {}
    docs = []
    try:
        docs = qa_chain.retriever.invoke(prompt)
    except Exception:
        try:
            docs = qa_chain.retriever.get_relevant_documents(prompt)
        except Exception:
            pass
    return get_source_pages_from_documents(docs, docs_dir)


def collect_relevant_images_for_response(
    selected_docs: list[Document],
    prompt: str,
    llm_answer: str,
    docs_dir: str = DOCS_DIR,
    min_relevance_score: float = 0.45,
) -> tuple[list[bytes], str]:
    if not selected_docs:
        return [], "⚠️ Aucun document source fourni"

    response_images_bytes: list[bytes] = []
    requested_images = _estimate_requested_image_count(prompt, llm_answer)

    precomputed_kw = _build_relevance_keywords(prompt, llm_answer)
    if len(precomputed_kw) < 2:
        return [], "⚠️ Mots-clés insuffisants pour filtrer les images"

    try:
        source_pages = get_source_pages_from_documents(selected_docs, docs_dir)
        debug_lines = [
            f"📂 Sources PDF (depuis docs sélectionnés): {len(source_pages)}",
            f"🎯 Images visées: {requested_images}",
            f"🔑 Mots-clés: {precomputed_kw[:8]}",
            f"📏 Seuil relevance: {min_relevance_score}",
        ]
        seen_hashes: set[str] = set()

        for pdf_path, pages in source_pages.items():
            if len(response_images_bytes) >= requested_images:
                break
            remaining_slots = requested_images - len(response_images_bytes)
            images = extract_relevant_images_from_pdf(
                pdf_path=pdf_path,
                page_numbers=pages,
                question_text=prompt,
                llm_answer=llm_answer,
                seen_hashes=seen_hashes,
                current_count=len(response_images_bytes),
                max_images_per_response=requested_images,
                max_images_for_pdf=min(remaining_slots, len(set(pages))),
                min_relevance_score=min_relevance_score,
                precomputed_keywords=precomputed_kw,
            )
            debug_lines.append(f"  → {len(images)} image(s) depuis {os.path.basename(pdf_path)}")
            response_images_bytes.extend(images)

        debug_lines.append(f"✅ Images finales: {len(response_images_bytes)}")
        return response_images_bytes, "\n".join(debug_lines)
    except Exception as exc:
        return [], f"❌ Erreur extraction images: {exc}"


# =====================================================
# INITIALISATION DE LA CHAÎNE QA
# =====================================================

def init_qa_chain(docs_dir: str, api_key: str, extra_documents: list[Document] | None = None) -> object | None:
    all_documents: list[Document] = []
    try:
        if os.path.exists(docs_dir):
            pdf_loader = DirectoryLoader(docs_dir + "/", glob="*.pdf", loader_cls=PyPDFLoader)
            all_documents.extend(pdf_loader.load())
    except Exception as e:
        print(f"Erreur chargement PDF: {e}")

    if os.path.exists(docs_dir):
        all_documents.extend(load_excel_files(docs_dir))

    if extra_documents:
        all_documents.extend(extra_documents)

    if not all_documents:
        print(f"⚠️ Aucun document chargé depuis {docs_dir}")
        return None

    return build_qa_chain_from_documents(all_documents, api_key=api_key)


def build_qa_chain_from_documents(documents: list[Document], api_key: str, retriever_k: int = 8) -> object | None:
    if not documents:
        return None

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=200,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    chunks = text_splitter.split_documents(documents)
    if not chunks:
        return None

    embeddings = get_embed_model()
    vector_db = Chroma.from_documents(documents=chunks, embedding=embeddings)

    llm = ChatGroq(
        groq_api_key=api_key,
        model_name="llama-3.1-8b-instant",
        temperature=0,
    )

    return RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=vector_db.as_retriever(search_kwargs={"k": 15}),
    )


def load_local_documents(docs_dir: str) -> list[Document]:
    documents: list[Document] = []
    try:
        if os.path.exists(docs_dir):
            pdf_loader = DirectoryLoader(docs_dir + "/", glob="*.pdf", loader_cls=PyPDFLoader)
            documents.extend(pdf_loader.load())
    except Exception as exc:
        print(f"Erreur chargement PDF locaux: {exc}")
    if os.path.exists(docs_dir):
        documents.extend(load_excel_files(docs_dir))
    return documents


# =====================================================
# INDEX ELIUM LOCAL — SEED QUERIES ENRICHIES
# =====================================================

def index_all_elium_locally(
    base_url: str,
    login_email: str,
    login_password: str,
    docs_dir: str = DOCS_DIR,
) -> tuple[int, str]:
    normalized_base = _normalize_elium_base_url(base_url)
    if not normalized_base or not login_email or not login_password:
        return 0, "Elium désactivé (identifiants manquants)"

    session, login_debug = _create_elium_authenticated_session(normalized_base, login_email, login_password)
    if session is None:
        return 0, login_debug

    SEED_QUERIES = [
        "cover", "installation", "configuration", "session", "manager",
        "provider", "version", "licence", "erreur", "paramètre",
        "base de données", "SQL", "réseau", "utilisateur", "module",
        "rapport", "impression", "devis", "commande", "article",
        "mise à jour", "sauvegarde", "export", "import", "menu",
        "H0051", "virtual machine", "HASP", "sentinel", "clé de licence",
        "erreur lancement", "démarrage", "crash", "sablage", "vitrage",
        "chassis", "projet", "fournisseur", "muret", "toiture",
        "réinstallation", "désinstallation", "activation",
    ]

    all_docs: dict[str, Document] = {}

    for seed in SEED_QUERIES:
        try:
            variables = {"query": {"text": seed}, "recordAnalytics": False}
            response = session.post(
                f"{normalized_base}/graphql",
                headers=_elium_headers(),
                json={"query": ELIUM_SEARCH_QUERY, "variables": variables},
                timeout=60,
            )
            if response.status_code != 200:
                continue

            payload = response.json()
            stories = (((payload.get("data") or {}).get("me") or {}).get("search") or {}).get("stories") or []

            for story_result in stories:
                story = story_result.get("story") or {}
                version = story.get("version") or {}
                space = story.get("space") or {}

                story_id = str(story.get("id") or "").strip()
                if not story_id or story_id in all_docs:
                    continue

                title = str(version.get("title") or "").strip() or "Sans titre"
                excerpt_text = str((version.get("excerpt") or {}).get("text") or "").strip()
                clean_highlights = [
                    _clean_elium_snippet(str(s))
                    for s in (story_result.get("highlightedSnippets") or [])
                    if str(s).strip()
                ]

                content_parts = [f"TITRE: {title}"]
                if clean_highlights:
                    content_parts.append("EXTRAITS: " + " | ".join(clean_highlights))
                if excerpt_text:
                    content_parts.append(f"CONTENU: {excerpt_text}")

                page_content = "\n\n".join(content_parts)
                story_slug = str(story.get("slug") or "").strip()
                space_slug = str(space.get("slug") or "").strip()
                story_url = (
                    f"{normalized_base}/{space_slug}/{story_slug}" if space_slug and story_slug
                    else f"{normalized_base}/{story_slug}" if story_slug
                    else normalized_base
                )

                all_docs[story_id] = Document(
                    page_content=page_content[:30000],
                    metadata={"source": story_url, "kind": "elium_indexed", "title": title, "story_id": story_id, "space_name": str(space.get("name") or "").strip()},
                )

            print(f"[Elium Index] seed='{seed}' → {len(stories)} résultats | total={len(all_docs)}")
        except Exception as e:
            print(f"[Elium Index] Erreur seed '{seed}': {e}")
            continue

    doc_list = list(all_docs.values())
    if doc_list:
        os.makedirs(docs_dir, exist_ok=True)
        index_path = os.path.join(docs_dir, "elium_index.json")
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(
                [{"content": d.page_content, "metadata": d.metadata} for d in doc_list],
                f, ensure_ascii=False, indent=2,
            )
        return len(doc_list), f"✅ {len(doc_list)} articles Elium indexés"
    return 0, "⚠️ Aucun article trouvé dans Elium"


def load_elium_index_from_file(docs_dir: str = DOCS_DIR) -> list[Document]:
    index_path = os.path.join(docs_dir, "elium_index.json")
    if not os.path.exists(index_path):
        return []
    documents = []
    with open(index_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        for item in data:
            documents.append(Document(page_content=item["content"], metadata=item["metadata"]))
    return documents


# =====================================================
# ACTIONS LOCALES WINDOWS (Cover / Licence)
# =====================================================

def open_folder_and_launch() -> dict:
    results = {"folder_opened": False, "file_launched": False, "folder_path": None, "file_path": None, "message": ""}
    possible_paths = [r"C:\Cover\bin", r"C:\Program Files\Cover\bin", r"C:\Program Files (x86)\Cover\bin"]
    found_path = next((p for p in possible_paths if os.path.exists(p)), None)

    if found_path:
        try:
            subprocess.Popen(f'explorer "{found_path}"', shell=True)
            results["folder_opened"] = True
            results["folder_path"] = found_path
            results["message"] += f"📂 Dossier ouvert : {found_path}\n"
        except Exception as e:
            results["message"] += f"❌ Erreur dossier : {e}\n"

        exe_path = os.path.join(found_path, "LicenceManagerBoot.exe")
        if os.path.exists(exe_path):
            try:
                os.startfile(exe_path)
                results["file_launched"] = True
                results["file_path"] = exe_path
                results["message"] += "🚀 LicenceManagerBoot.exe lancé\n"
            except Exception as e:
                try:
                    subprocess.Popen([exe_path], shell=True)
                    results["file_launched"] = True
                    results["file_path"] = exe_path
                    results["message"] += "🚀 LicenceManagerBoot.exe lancé (alternative)\n"
                except Exception as e2:
                    results["message"] += f"❌ Erreur lancement : {e2}\n"
        else:
            results["message"] += "⚠️ LicenceManagerBoot.exe non trouvé\n"
    else:
        results["message"] = "❌ Dossier Cover/bin non trouvé"
    return results


def open_specific_folder(folder_path: str) -> tuple[bool, str]:
    try:
        if os.path.exists(folder_path):
            subprocess.Popen(f'explorer "{folder_path}"', shell=True)
            return True, f"📂 Dossier ouvert : {folder_path}"
        return False, f"❌ Dossier non trouvé : {folder_path}"
    except Exception as e:
        return False, f"❌ Erreur : {e}"


# =====================================================
# PERSISTANCE JSON DES CONVERSATIONS
# =====================================================

def get_conversations_list(base_dir: str = ".") -> list[dict]:
    conversations = []
    session_files = [f for f in os.listdir(base_dir) if f.startswith("chat_session_") and f.endswith(".json")]
    for file in session_files:
        try:
            with open(os.path.join(base_dir, file), "r", encoding="utf-8") as f:
                data = json.load(f)
            messages = data.get("messages", [])
            if not messages:
                continue
            first_user_msg = ""
            for msg in messages:
                if msg["role"] == "user":
                    first_user_msg = msg["content"][:35]
                    if len(msg["content"]) > 35:
                        first_user_msg += "..."
                    break
            last_saved = data.get("last_saved", "")
            date_obj = datetime.strptime(last_saved, "%Y-%m-%d %H:%M:%S") if last_saved else datetime.now()
            conversations.append({
                "id": file.replace("chat_session_", "").replace(".json", ""),
                "title": first_user_msg or "Nouvelle conversation",
                "date": date_obj.strftime("%Y-%m-%d"),
                "time": date_obj.strftime("%H:%M"),
                "date_formatted": date_obj.strftime("%d/%m/%Y"),
            })
        except Exception:
            pass
    conversations.sort(key=lambda x: x["date"] + x["time"], reverse=True)
    return conversations


def save_conversation(state: dict, base_dir: str = ".") -> str:
    if not state.get("messages"):
        return ""
    conversation_id = state.get("current_conversation_id", datetime.now().strftime("%Y%m%d_%H%M%S"))
    session_data = {
        "conversation_id": conversation_id,
        "messages": state.get("messages", []),
        "pending_version": state.get("pending_version"),
        "pending_brands": state.get("pending_brands", []),
        "last_version": state.get("last_version"),
        "last_brand": state.get("last_brand"),
        "pending_provider": state.get("pending_provider"),
        "pending_provider_brands": state.get("pending_provider_brands", []),
        "last_provider": state.get("last_provider"),
        "static_conversation_active": state.get("static_conversation_active", False),
        "static_conversation_step": state.get("static_conversation_step", 0),
        "selected_brand": state.get("selected_brand"),
        "last_action": state.get("last_action"),
        "last_action_brand": state.get("last_action_brand"),
        "last_saved": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    filename = os.path.join(base_dir, f"chat_session_{conversation_id}.json")
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(session_data, f, ensure_ascii=False, indent=2)
    return conversation_id


def load_conversation(conversation_id: str, base_dir: str = ".") -> dict | None:
    filename = os.path.join(base_dir, f"chat_session_{conversation_id}.json")
    if not os.path.exists(filename):
        return None
    with open(filename, "r", encoding="utf-8") as f:
        data = json.load(f)
    state = build_default_state()
    state.update({
        "messages": data.get("messages", []),
        "pending_version": data.get("pending_version"),
        "pending_brands": data.get("pending_brands", []),
        "last_version": data.get("last_version"),
        "last_brand": data.get("last_brand"),
        "pending_provider": data.get("pending_provider"),
        "pending_provider_brands": data.get("pending_provider_brands", []),
        "last_provider": data.get("last_provider"),
        "static_conversation_active": data.get("static_conversation_active", False),
        "static_conversation_step": data.get("static_conversation_step", 0),
        "selected_brand": data.get("selected_brand"),
        "current_conversation_id": conversation_id,
        "last_action": data.get("last_action"),
        "last_action_brand": data.get("last_action_brand"),
    })
    return state


def clear_session(state: dict) -> None:
    state.update(build_default_state())


# =====================================================
# UTILITAIRES DE DÉTECTION DANS LE PROMPT
# =====================================================

def extract_brand_from_prompt(prompt: str, docs_dir: str = DOCS_DIR) -> str | None:
    for b in get_all_brands(docs_dir):
        if b.lower() in prompt.lower():
            return b
    return None


def extract_provider_number(prompt: str) -> str | None:
    if re.search(r"\d+\.\d+\.\d+\.\d+", prompt):
        return None
    m = re.search(r"\b(\d{4}\.\d{2,3})\b", prompt)
    if m:
        return m.group(1)
    m = re.search(r"\b(\d{3,4})\b", prompt)
    if m:
        return m.group(1)
    return None


def is_provider_request(prompt: str) -> bool:
    provider_keywords = [
        "provider", "providers", "fournisseur", "fournisseurs",
        "gitlab-provider", "cover_provider", "installux",
        "lien provider", "télécharger provider", "installer provider",
    ]
    return any(k in prompt.lower() for k in provider_keywords)


INSTALL_KEYWORDS = [
    "installer", "réinstaller", "installation", "réinstallation",
    "télécharger", "download", "install", "setup",
    "lien d'installation", "lien de téléchargement", "lien pour installer",
    "obtenir cover", "avoir cover",
]


def is_install_request(prompt: str) -> bool:
    return any(kw in prompt.lower() for kw in INSTALL_KEYWORDS)


def is_affirmative(prompt: str) -> bool:
    affirmative_words = [
        "oui", "yes", "ok", "d'accord", "bien sûr", "je veux", "avec plaisir",
        "volontiers", "tout à fait", "exactement", "absolument", "parfait",
        "carrément", "ouais", "yep", "yup", "affirmative", "affirmatif",
        "positif", "ça marche", "bien reçu", "entendu", "go", "allons-y",
        "c'est ça", "bien", "super", "ok ok",
    ]
    return any(w in prompt.lower() for w in affirmative_words)


def is_negative(prompt: str) -> bool:
    negative_words = [
        "non", "no", "pas besoin", "non merci", "pas nécessaire", "sans provider",
        "sans", "nope", "nan", "jamais", "absolument pas", "certainement pas",
        "pas du tout", "inutile", "c'est bon", "ça ira", "merci pas",
        "pas la peine", "pas utile", "ça ne m'intéresse pas",
    ]
    return any(w in prompt.lower() for w in negative_words)


def images_to_base64(images_bytes: list[bytes]) -> list[str]:
    return [base64.b64encode(img).decode("utf-8") for img in images_bytes]


def base64_to_images(images_b64: list[str]) -> list[bytes]:
    return [base64.b64decode(b64) for b64 in images_b64]


def get_filename_from_url(url: str) -> str:
    """Extrait le nom de fichier d'une URL en ignorant les query params."""
    try:
        parsed = urlparse(url)
        path = parsed.path
        name = unquote(os.path.basename(path.rstrip("/")))
        return name if name else url
    except Exception:
        return url