import streamlit as st
import os
import re
import json
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_classic.chains import RetrievalQA
from langchain_core.documents import Document
from collections import Counter
from langchain_groq import ChatGroq
import subprocess
import platform
import base64
import fitz
from PIL import Image
import io
import requests
import tempfile
import shutil


# Configuration de la page
st.set_page_config(page_title="ChatBoot", page_icon="🤖", layout="wide")

# Chargement des variables d'environnement
load_dotenv()
api_key = st.secrets.get("GROQ_API_KEY") or os.getenv("GROQ_API_KEY")

# =====================================================
# GOOGLE DRIVE — TÉLÉCHARGEMENT DES DOCS
# =====================================================

# ID du dossier Google Drive partagé (extrait depuis votre lien)
GDRIVE_FOLDER_ID = "1oz01FMVvm5HTIcS_U2hKqYVu9ZRL8QZU"

# Clé API Google (AIza...) — créez-la sur https://console.cloud.google.com
GDRIVE_API_KEY = st.secrets.get("GDRIVE_API_KEY") or os.getenv("GDRIVE_API_KEY", "")

# Dossier temporaire local pour stocker les fichiers téléchargés
DOCS_DIR = os.path.join(tempfile.gettempdir(), "chatboot_docs")


def _download_file_from_drive(file_id: str, dest_path: str) -> bool:
    """
    Télécharge un fichier depuis Google Drive en gérant :
    1. L'URL directe avec API key (fichiers publics)
    2. Le fallback via l'URL uc?export=download (fichiers publics "Tout le monde avec le lien")
    3. La page de confirmation de téléchargement pour les gros fichiers

    Le dossier Drive DOIT être partagé en accès "Tout le monde avec le lien" (lecteur).
    """
    session = requests.Session()

    # ── Tentative 1 : API key + alt=media ─────────────────────────────────
    url_api = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media&key={GDRIVE_API_KEY}"
    try:
        r = session.get(url_api, timeout=60, stream=True)
        if r.status_code == 200:
            with open(dest_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True
    except Exception:
        pass

    # ── Tentative 2 : URL publique uc?export=download ─────────────────────
    # Fonctionne quand le fichier est partagé "Tout le monde avec le lien"
    url_public = f"https://drive.google.com/uc?export=download&id={file_id}"
    try:
        r = session.get(url_public, timeout=60, stream=True)

        # Google renvoie parfois une page HTML de confirmation pour les gros fichiers
        content_type = r.headers.get("Content-Type", "")
        if "text/html" in content_type:
            # Extraire le token de confirmation depuis la page HTML
            confirm_token = None

            # Méthode 1 : cookie "download_warning"
            for key, value in r.cookies.items():
                if key.startswith("download_warning"):
                    confirm_token = value
                    break

            # Méthode 2 : champ caché dans le formulaire HTML
            if not confirm_token:
                match = re.search(r'confirm=([0-9A-Za-z_\-]+)', r.text)
                if match:
                    confirm_token = match.group(1)

            # Méthode 3 : nouveau format Google Drive (uuid)
            if not confirm_token:
                match = re.search(r'"([^"]+)"\s*,\s*"download_warning"', r.text)
                if match:
                    confirm_token = match.group(1)

            if confirm_token:
                url_confirm = f"https://drive.google.com/uc?export=download&confirm={confirm_token}&id={file_id}"
                r = session.get(url_confirm, timeout=120, stream=True)
            else:
                # Essayer avec &confirm=t (fonctionne souvent pour les nouveaux liens)
                url_confirm = f"https://drive.google.com/uc?export=download&confirm=t&id={file_id}"
                r = session.get(url_confirm, timeout=120, stream=True)

        if r.status_code == 200:
            # Vérifier que ce n'est pas une page d'erreur HTML
            content_type = r.headers.get("Content-Type", "")
            if "text/html" in content_type:
                # Contenu HTML = erreur de permission ou virus-scan
                return False

            with open(dest_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True

    except Exception:
        pass

    # ── Tentative 3 : URL export thumbnail / lien direct alternatif ───────
    url_alt = f"https://drive.usercontent.google.com/download?id={file_id}&export=download&authuser=0&confirm=t"
    try:
        r = session.get(url_alt, timeout=120, stream=True)
        if r.status_code == 200:
            content_type = r.headers.get("Content-Type", "")
            if "text/html" not in content_type:
                with open(dest_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
                return True
    except Exception:
        pass

    return False


@st.cache_resource(show_spinner=False)
def download_docs_from_drive():
    """
    Télécharge tous les fichiers du dossier Google Drive partagé.

    Prérequis côté Google Drive :
    - Le dossier doit être partagé : "Tout le monde avec le lien" → Lecteur
    - L'API Google Drive doit être activée dans votre projet Google Cloud
    - La clé API doit être sans restriction d'IP (ou avec l'IP du serveur Streamlit autorisée)

    Retourne le chemin vers le dossier local contenant les fichiers.
    """
    if os.path.exists(DOCS_DIR):
        shutil.rmtree(DOCS_DIR)
    os.makedirs(DOCS_DIR, exist_ok=True)

    errors = []

    try:
        # ── Lister les fichiers du dossier via l'API Google Drive v3 ──────
        api_url = "https://www.googleapis.com/drive/v3/files"
        params = {
            "q": f"'{GDRIVE_FOLDER_ID}' in parents and trashed=false",
            "fields": "files(id, name, mimeType)",
            "key": GDRIVE_API_KEY,
            "pageSize": 100,
        }
        resp = requests.get(api_url, params=params, timeout=30)
        resp.raise_for_status()
        files = resp.json().get("files", [])

        if not files:
            st.session_state["_drive_error"] = (
                "⚠️ Aucun fichier trouvé dans le dossier Drive.\n"
                "Vérifiez :\n"
                "1. Que le dossier est partagé 'Tout le monde avec le lien'\n"
                "2. Que la clé API est valide et que l'API Drive est activée\n"
                f"3. Folder ID : {GDRIVE_FOLDER_ID}"
            )
            return DOCS_DIR

        downloaded = 0
        skipped = 0

        for f in files:
            file_id   = f["id"]
            file_name = f["name"]
            mime      = f.get("mimeType", "")

            # Ignorer sous-dossiers et Google Docs natifs (Docs, Sheets, Slides…)
            if mime == "application/vnd.google-apps.folder":
                skipped += 1
                continue
            if mime.startswith("application/vnd.google-apps"):
                skipped += 1
                continue

            dest = os.path.join(DOCS_DIR, file_name)
            success = _download_file_from_drive(file_id, dest)

            if success:
                downloaded += 1
            else:
                errors.append(
                    f"❌ {file_name} — impossible de télécharger (403 Forbidden).\n"
                    f"   → Vérifiez que CE fichier est accessible publiquement\n"
                    f"      (le partage du dossier ne suffit pas toujours,\n"
                    f"       chaque fichier doit hériter des permissions)."
                )

        summary = f"✅ {downloaded} fichier(s) téléchargé(s)"
        if skipped:
            summary += f", {skipped} ignoré(s) (Google Docs natifs / dossiers)"
        if errors:
            summary += f", {len(errors)} erreur(s)"

        st.session_state["_drive_error"] = ("\n\n".join(errors)) if errors else ""
        st.session_state["_drive_summary"] = summary

    except requests.exceptions.HTTPError as http_err:
        status = http_err.response.status_code if http_err.response else "?"
        if status == 403:
            st.session_state["_drive_error"] = (
                f"❌ Erreur 403 lors du listage du dossier Drive.\n"
                f"Causes possibles :\n"
                f"1. L'API Google Drive n'est pas activée dans votre projet Cloud\n"
                f"2. La clé API est invalide ou a des restrictions d'IP\n"
                f"3. Le dossier n'est pas partagé publiquement\n"
                f"URL : {api_url}"
            )
        elif status == 404:
            st.session_state["_drive_error"] = (
                f"❌ Dossier Drive introuvable (404). Vérifiez le GDRIVE_FOLDER_ID."
            )
        else:
            st.session_state["_drive_error"] = f"❌ Erreur HTTP {status} : {http_err}"
    except Exception as e:
        st.session_state["_drive_error"] = f"❌ Erreur inattendue : {e}"

    return DOCS_DIR


with st.sidebar:
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        logo_path = "IMG.png"
        if os.path.exists(logo_path):
            st.image(logo_path, width=110)
    st.markdown("---")

# =====================================================
# CONVERSATION STATIQUE POUR CHANGEMENT D'ORDINATEUR
# =====================================================

if "static_conversation_step" not in st.session_state:
    st.session_state.static_conversation_step = 0
if "static_conversation_active" not in st.session_state:
    st.session_state.static_conversation_active = False
if "selected_brand" not in st.session_state:
    st.session_state.selected_brand = None

STATIC_RESPONSES = {
    "start": {
        "trigger": ["changer d'ordinateur", "réinstaller", "nouvel ordinateur", "changement pc", "j'ai changé d'ordinateur", "réinstaller sur mon nouvel ordinateur"],
        "response": """### 💻 Réinstallation sur un nouvel ordinateur

Si vous avez changé d'ordinateur et souhaitez conserver tous vos projets, vous pouvez :

**Copier votre dossier Cover** : 
1. Copiez le dossier `C:\\Cover` de votre ancien ordinateur vers un disque externe
2. Collez-le sur le `C:\\` de votre nouvel ordinateur

**Souhaitez-vous conserver tous vos projets ? (oui/non)**
"""
    },
    "ask_brand_after_yes": {
        "trigger": ["oui", "yes", "ok", "d'accord", "je veux", "oui je veux", "bien sûr"],
        "response": """### ✅ Parfait !

Alors merci de me dire : **quel fournisseur et quelle version utilisez-vous ?**


"""
    },
    "ask_brand_after_no": {
        "trigger": ["non", "no", "pas besoin", "non merci", "pas nécessaire"],
        "response": """### 👍 D'accord !

Pas de souci pour les projets. Alors merci de me dire : **quel fournisseur et quelle version utilisez-vous ?**


"""
    },
    "aliplast_response": {
        "trigger": ["aliplast", "je suis aliplast", "c'est aliplast", "aliplast justement"],
        "response": """### 📦 Installation pour Aliplast

Voici les fichiers nécessaires pour votre installation :

**1. Installer Cover :**
https://cover-2-x.s3.amazonaws.com/2.3.1/special_aliplast/3104/software/Cover_Install_Aliplast_2.3.1.3104-SK-special_aliplast.exe

**2. Installer le Provider :**
https://bucket.cover3d.com/gitlab-provider-fabric/Cover_provider_Aliplast_2604.065.exe

**3. Installer les HASPs (drivers de licence) :**
https://cover3d.com.s3.amazonaws.com/download/HASPUserSetup.exe

**📌 Procédure :**
Téléchargez et installez les 3 fichiers dans l'ordre ci-dessus

**✅ Une fois tous ces éléments installés, merci de m'informer.**
"""
    },
    "rideau_response": {
        "trigger": ["rideau", "je suis rideau", "c'est rideau", "rideau justement", "ah non je suis rideau"],
        "response": """### 📦 Installation pour Rideau

Voici les fichiers nécessaires pour votre installation :

**1. Installer Cover (version licence) :**
`http://cover-2-x.s3.amazonaws.com/2.3.1/monthly_2.3_2024_12/3087/software/Cover_Install_2.3.1.3087-SK-monthly_2.3_2024_12.exe`

**2. Installer le Provider :**
`http://cover3d.com.s3.amazonaws.com/download/Installux%20V2603.1.zip`

**3. Installer les HASPs (drivers de licence) :**
`https://cover3d.com.s3.amazonaws.com/download/HASPUserSetup.exe`

**📌 Procédure :**
1. Téléchargez et installez le Cover (version licence)
2. Décompressez et installez le Provider
3. Installez les drivers HASP

**✅ Une fois tous ces éléments installés, merci de m'informer.**
"""
    },
    "completion": {
        "trigger": ["terminé", "c'est fait", "fini", "installé", "c bon", "ok c bon"],
        "response": """### 🎉 Installation terminée !

Félicitations ! Votre Cover est maintenant installé sur votre nouvel ordinateur.

**Prochaines étapes :**
# Transfert de licence Cover — Étape par étape

## Avant de commencer

* Installez **Cover version SK** sur le nouveau PC (PC de destination).
* Téléchargez et exécutez le logiciel **RUS_COVER.exe** sur les deux machines :

  * ancien PC (PC de départ)
  * nouveau PC (PC de destination)

---

# Étape 1 : Générer le fichier `.id` sur le nouveau PC

📍 **Sur le PC de destination (nouveau PC)**

1. Ouvrez **RUS_COVER.exe**
2. Cliquez sur l'onglet **"Transfer Licence"**
3. Cliquez sur **"..."** ou **"Collect Information"**
4. Choisissez :

   * le nom du fichier
   * l'emplacement où enregistrer le fichier
5. Le logiciel génère un fichier avec l'extension :

   ```text
   .id
   ```

✅ Ce fichier identifie le nouveau PC.

---

# Étape 2 : Générer le fichier de transfert `.h2h`

📍 **Sur le PC de départ (ancien PC)**

1. Copiez le fichier `.id` généré à l'étape 1 vers l'ancien PC
2. Ouvrez **RUS_COVER.exe**
3. Cliquez sur l'onglet **"Transfer Licence"**
4. Dans la liste des licences affichées :

   * recherchez la licence **Cover**
   * sélectionnez uniquement la bonne licence

⚠️ Attention :
Il peut y avoir plusieurs licences Sentinel. Vérifiez bien que vous choisissez la licence Cover.

5. Dans le premier champ :

   * sélectionnez le fichier `.id`

6. Dans le second champ :

   * choisissez l'emplacement où sera créé le fichier :

   ```text
   .h2h
   ```

7. Cliquez sur :

   ```text
   Generate Licence Transfer File
   ```

✅ Le fichier `.h2h` est alors créé.

⚠️ Important :

* la licence est automatiquement supprimée de l'ancien PC
* Cover ne fonctionnera plus sur cette machine
* le transfert fonctionne uniquement avec le PC ayant généré le fichier `.id`

---

# Étape 3 : Installer la licence sur le nouveau PC

📍 **Sur le PC de destination (nouveau PC)**

1. Copiez le fichier :

   ```text
   .h2h
   ```

   vers le nouveau PC

2. Ouvrez **RUS_COVER.exe**

3. Allez dans l'onglet :

   ```text
   Apply Licence File
   ```

4. Cliquez sur :

   ```text
   ...
   ```

   puis sélectionnez le fichier `.h2h`

5. Cliquez sur :

   ```text
   Apply Update
   ```

✅ La licence est maintenant installée sur le nouveau PC.
✅ Cover est utilisable normalement.


N'hésitez pas si vous avez d'autres questions ! 💪
"""
    },
    "classic_version_install": {
        "trigger": [
            "version classique",
            "installer la version classique",
            "dernières bases",
            "garder les projets",
            "GNP avec groupes de droits",
            "version actuelle installée sur son poste",
            "anciennement utilisée pour GNP",
            "profils système",
            "groupes de droits",
            "La version de cover actuelle installée"
        ],
        "steps": {
            1: {
                "response": """### 🔄 Installation version classique

Je comprends que vous souhaitez installer la version **classique** de Cover avec les dernières bases, tout en conservant vos projets en mémoire.

**Quel fournisseur (marque) appartient-il ?**  
""",
                "next_step": 2,
                "expected": ["profils système", "profils systeme", "aliplast", "gnp"]
            },
            2: {
                "response_profils_systeme": """### 📦 Installation pour Profils Système

Pour installer la version et le provider mis à jour, vous devez être connecté à votre **compte Profils Système**.

Vous pourrez y trouver tous les éléments nécessaires :
- La version classique de Cover
- Les dernières bases de données
- Les providers mis à jour

**🔐 Concernant les groupes de droits :**

Pour gérer les groupes de droits, procédez comme suit :

1. Allez dans : `C:\\Cover\\XMan\\Database`
2. Ouvrez le **Manager** de base de données
3. Naviguez vers le tableau **Application**
4. Recherchez les lignes contenant "utilisateur"
5. **Supprimez** les lignes utilisateur
6. **Gardez uniquement** la ligne "Administrateur"

✅ Une fois ces étapes réalisées, votre installation sera propre avec les droits administrateur uniquement.

**Avez-vous besoin d'aide supplémentaire ?**""",
                "next_step": 3,
                "expected": []
            },
            3: {
                "response_yes": "N'hésitez pas à me décrire votre problème précisément, je vous guiderai.",
                "response_no": "Parfait ! N'oubliez pas de redémarrer Cover après les modifications. Bonne continuation ! 💪",
                "next_step": 0,
                "expected": []
            }
        }
    }
}


# =====================================================
# FONCTION DETECT_STATIC_CONVERSATION
# =====================================================

def detect_static_conversation(prompt):
    prompt_lower = prompt.lower()

    classic_scenario = STATIC_RESPONSES.get("classic_version_install")
    if classic_scenario:
        for trigger in classic_scenario["trigger"]:
            if trigger.lower() in prompt_lower:
                st.session_state.static_conversation_active = True
                st.session_state.static_conversation_step = 1
                st.session_state.current_static_scenario = "classic_version_install"
                return classic_scenario["steps"][1]["response"]

    for trigger in STATIC_RESPONSES["start"]["trigger"]:
        if trigger in prompt_lower:
            st.session_state.static_conversation_active = True
            st.session_state.static_conversation_step = 1
            st.session_state.current_static_scenario = "change_pc"
            return STATIC_RESPONSES["start"]["response"]

    if not st.session_state.static_conversation_active:
        return None

    if st.session_state.get("current_static_scenario") == "classic_version_install":
        step = st.session_state.static_conversation_step

        if step == 1:
            st.session_state.static_conversation_step = 2
            return STATIC_RESPONSES["classic_version_install"]["steps"][2]["response_profils_systeme"]

        elif step == 2:
            if any(word in prompt_lower for word in ["oui", "yes", "ok", "d'accord"]):
                st.session_state.static_conversation_step = 3
                return STATIC_RESPONSES["classic_version_install"]["steps"][3]["response_yes"]
            elif any(word in prompt_lower for word in ["non", "no", "pas besoin"]):
                reset_static_conversation()
                return STATIC_RESPONSES["classic_version_install"]["steps"][3]["response_no"]
            else:
                return """❓ **Avez-vous besoin d'aide supplémentaire ?** (répondez par oui ou non)"""

        elif step == 3:
            reset_static_conversation()
            return STATIC_RESPONSES["classic_version_install"]["steps"][3].get("response_no", "Merci et bonne continuation !")

    if st.session_state.get("current_static_scenario") == "change_pc":
        if st.session_state.static_conversation_step == 1:
            for trigger in STATIC_RESPONSES["ask_brand_after_yes"]["trigger"]:
                if trigger in prompt_lower:
                    st.session_state.static_conversation_step = 2
                    return STATIC_RESPONSES["ask_brand_after_yes"]["response"]

            for trigger in STATIC_RESPONSES["ask_brand_after_no"]["trigger"]:
                if trigger in prompt_lower:
                    st.session_state.static_conversation_step = 2
                    return STATIC_RESPONSES["ask_brand_after_no"]["response"]

        elif st.session_state.static_conversation_step == 2:
            for trigger in STATIC_RESPONSES["aliplast_response"]["trigger"]:
                if trigger in prompt_lower:
                    st.session_state.static_conversation_step = 3
                    st.session_state.selected_brand = "Aliplast"
                    return STATIC_RESPONSES["aliplast_response"]["response"]

            for trigger in STATIC_RESPONSES["rideau_response"]["trigger"]:
                if trigger in prompt_lower:
                    st.session_state.static_conversation_step = 3
                    st.session_state.selected_brand = "Rideau"
                    return STATIC_RESPONSES["rideau_response"]["response"]

        elif st.session_state.static_conversation_step == 3:
            for trigger in STATIC_RESPONSES["completion"]["trigger"]:
                if trigger in prompt_lower:
                    reset_static_conversation()
                    return STATIC_RESPONSES["completion"]["response"]

    return None


def reset_static_conversation():
    st.session_state.static_conversation_active = False
    st.session_state.static_conversation_step = 0
    st.session_state.selected_brand = None
    st.session_state.current_static_scenario = None


# =====================================================
# DÉTECTION DES REQUÊTES CHAÎNÉES
# =====================================================

def detect_chained_request(prompt):
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
            candidate = match.group(1).strip().rstrip('?').strip()
            brands = get_all_brands()
            for brand in brands:
                if brand.lower() == candidate.lower() or candidate.lower() in brand.lower() or brand.lower() in candidate.lower():
                    return brand

    return None


def format_versions_response(brand_name, results_versions):
    if not results_versions:
        return f"Aucune version trouvée pour **{brand_name}**."

    response_lines = [f"### 📋 Versions disponibles pour **{brand_name}** :"]
    for item in results_versions:
        version_value = item.get("version", "")
        url_value = item.get("url", "NON TROUVEE")
        if url_value != "NON TROUVEE":
            response_lines.append(f"- {version_value} : {url_value}")
        else:
            response_lines.append(f"- {version_value} : URL NON TROUVEE")
    return "\n".join(response_lines)


# =====================================================
# FONCTIONS D'AUTOMATISATION (locale — Windows uniquement)
# =====================================================

def open_folder_and_launch():
    results = {
        "folder_opened": False,
        "file_launched": False,
        "folder_path": None,
        "file_path": None,
        "message": ""
    }

    possible_paths = [
        r"C:\Cover\bin",
        r"C:\Program Files\Cover\bin",
        r"C:\Program Files (x86)\Cover\bin"
    ]

    found_path = None
    for path in possible_paths:
        if os.path.exists(path):
            found_path = path
            break

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
                results["message"] += f"🚀 LicenceManagerBoot.exe lancé\n"
            except Exception as e:
                try:
                    subprocess.Popen([exe_path], shell=True)
                    results["file_launched"] = True
                    results["file_path"] = exe_path
                    results["message"] += f"🚀 LicenceManagerBoot.exe lancé (alternative)\n"
                except Exception as e2:
                    results["message"] += f"❌ Erreur lancement : {e2}\n"
        else:
            results["message"] += f"⚠️ LicenceManagerBoot.exe non trouvé\n"
    else:
        results["message"] = "❌ Dossier Cover/bin non trouvé"

    return results


def open_specific_folder(folder_path):
    try:
        if os.path.exists(folder_path):
            subprocess.Popen(f'explorer "{folder_path}"', shell=True)
            return True, f"📂 Dossier ouvert : {folder_path}"
        else:
            return False, f"❌ Dossier non trouvé : {folder_path}"
    except Exception as e:
        return False, f"❌ Erreur : {e}"


# =====================================================
# FONCTIONS DE PERSISTANCE JSON
# =====================================================

def get_conversations_list():
    conversations = []
    session_files = [f for f in os.listdir('.') if f.startswith('chat_session_') and f.endswith('.json')]

    for file in session_files:
        try:
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            messages = data.get("messages", [])
            if messages:
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


def save_current_conversation():
    if not st.session_state.messages:
        return None

    conversation_id = st.session_state.get("current_conversation_id", datetime.now().strftime("%Y%m%d_%H%M%S"))

    session_data = {
        "conversation_id": conversation_id,
        "messages": st.session_state.messages,
        "pending_version": st.session_state.pending_version,
        "pending_brands": st.session_state.pending_brands,
        "last_version": st.session_state.last_version,
        "last_brand": st.session_state.last_brand,
        "pending_provider": st.session_state.pending_provider,
        "pending_provider_brands": st.session_state.pending_provider_brands,
        "last_provider": st.session_state.last_provider,
        "static_conversation_active": st.session_state.static_conversation_active,
        "static_conversation_step": st.session_state.static_conversation_step,
        "selected_brand": st.session_state.selected_brand,
        "last_action": st.session_state.get("last_action", None),
        "last_action_brand": st.session_state.get("last_action_brand", None),
        "last_saved": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    filename = f"chat_session_{conversation_id}.json"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(session_data, f, ensure_ascii=False, indent=2)

    st.session_state.current_conversation_id = conversation_id
    return conversation_id


def load_conversation(conversation_id):
    filename = f"chat_session_{conversation_id}.json"
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)

        st.session_state.messages = data.get("messages", [])
        st.session_state.pending_version = data.get("pending_version", None)
        st.session_state.pending_brands = data.get("pending_brands", [])
        st.session_state.last_version = data.get("last_version", None)
        st.session_state.last_brand = data.get("last_brand", None)
        st.session_state.pending_provider = data.get("pending_provider", None)
        st.session_state.pending_provider_brands = data.get("pending_provider_brands", [])
        st.session_state.last_provider = data.get("last_provider", None)
        st.session_state.static_conversation_active = data.get("static_conversation_active", False)
        st.session_state.static_conversation_step = data.get("static_conversation_step", 0)
        st.session_state.selected_brand = data.get("selected_brand", None)
        st.session_state.current_conversation_id = conversation_id
        st.session_state.last_action = data.get("last_action", None)
        st.session_state.last_action_brand = data.get("last_action_brand", None)
        return True
    return False


def clear_session():
    st.session_state.messages = []
    st.session_state.pending_version = None
    st.session_state.pending_brands = []
    st.session_state.last_version = None
    st.session_state.last_brand = None
    st.session_state.pending_provider = None
    st.session_state.pending_provider_brands = []
    st.session_state.last_provider = None
    st.session_state.static_conversation_active = False
    st.session_state.static_conversation_step = 0
    st.session_state.selected_brand = None
    st.session_state.current_conversation_id = None
    st.session_state.last_action = None
    st.session_state.last_action_brand = None
    st.session_state.images_cache = {}


def new_conversation():
    clear_session()
    st.rerun()


# =====================================================
# FONCTIONS EXCEL — utilisent DOCS_DIR au lieu de 'docs'
# =====================================================

def load_excel_files(directory_path):
    documents = []
    try:
        for file in os.listdir(directory_path):
            if file.endswith(('.xlsx', '.xls')):
                file_path = os.path.join(directory_path, file)
                excel_data = pd.read_excel(file_path, sheet_name=None)

                for sheet_name, df in excel_data.items():
                    df = df.fillna("")
                    df = df.astype(str)

                    for idx, row in df.iterrows():
                        row_text = []
                        version_found = None
                        url_found = None

                        for col_name, value in row.items():
                            value_str = str(value)

                            versions = re.findall(r'\d+\.\d+\.\d+\.\d+', value_str)
                            if versions:
                                version_found = versions[0]
                                row_text.append(f"VERSION: {versions[0]}")

                            urls = re.findall(r'https?://[^\s]+', value_str)
                            if urls:
                                url_found = urls[0]
                                row_text.append(f"URL: {urls[0]}")

                            if value_str and value_str != 'nan' and len(value_str) > 0:
                                row_text.append(f"{col_name}: {value_str}")

                        if version_found or url_found:
                            enhanced_text = f"""
MARQUE: {sheet_name}
LIGNE: {idx + 2}
VERSION: {version_found if version_found else 'NON TROUVEE'}
URL: {url_found if url_found else 'NON TROUVEE'}
DONNEES_COMPLETES: {' | '.join(row_text)}
"""
                        else:
                            enhanced_text = f"""
MARQUE: {sheet_name}
LIGNE: {idx + 2}
DONNEES: {' | '.join(row_text)}
"""

                        doc = Document(
                            page_content=enhanced_text,
                            metadata={
                                "source": file,
                                "sheet": sheet_name,
                                "version": version_found if version_found else "",
                                "url": url_found if url_found else "",
                                "row": idx + 2
                            }
                        )
                        documents.append(doc)

    except Exception as e:
        st.warning(f"Erreur lors du chargement des Excel: {e}")
    return documents


def search_all_versions(version_number, specific_brand=None):
    results = []
    docs_dir = DOCS_DIR

    if not os.path.exists(docs_dir):
        return results

    version_clean = version_number.replace('.', '')

    for file in os.listdir(docs_dir):
        if file.endswith(('.xlsx', '.xls')):
            file_path = os.path.join(docs_dir, file)
            try:
                excel_data = pd.read_excel(file_path, sheet_name=None)
                for sheet_name, df in excel_data.items():
                    df = df.fillna("")
                    df = df.astype(str)

                    for idx, row in df.iterrows():
                        url_found = None
                        version_found = False

                        for col_name, value in row.items():
                            value_str = str(value)

                            if (version_number in value_str or
                                    version_clean in value_str.replace('.', '')):
                                version_found = True

                            if 'http' in value_str and ('.exe' in value_str or '.zip' in value_str):
                                url_found = value_str

                        if version_found:
                            if specific_brand and sheet_name.lower() != specific_brand.lower():
                                continue

                            if url_found:
                                results.append({"marque": sheet_name, "url": url_found})
                            else:
                                for col_name, value in row.items():
                                    value_str = str(value)
                                    if 'http' in value_str:
                                        url_found = value_str
                                        break
                                if url_found:
                                    results.append({"marque": sheet_name, "url": url_found})
            except Exception:
                continue

    return results


def get_direct_response(version, results):
    if not results:
        return f"Aucune URL trouvée pour {version}"

    unique_results = []
    seen = set()
    for r in results:
        key = (r['marque'], r['url'])
        if key not in seen:
            seen.add(key)
            unique_results.append(r)

    if len(unique_results) == 1:
        return unique_results[0]['url']

    response_lines = []
    for r in unique_results:
        response_lines.append(f"{r['marque']}: {r['url']}")

    return "\n".join(response_lines)


# =====================================================
# EXTRACTION D'IMAGES PDF
# =====================================================

# Limite globale d'images par réponse (toutes sources confondues)
MAX_IMAGES_PER_RESPONSE = 2


def _image_hash(image_bytes: bytes) -> str:
    """Hash MD5 rapide pour déduplication cross-PDF."""
    import hashlib
    return hashlib.md5(image_bytes).hexdigest()


def extract_relevant_images_from_pdf(pdf_path, page_numbers, question_text, llm_answer="",
                                     seen_hashes: set = None, current_count: int = 0):
    """
    Extrait UNE image pertinente par PDF, en choisissant la page qui correspond
    le mieux à la question.

    Stratégie :
    1. Construire les mots-clés depuis la question + réponse LLM
    2. Parmi les pages fournies par le retriever, choisir celle
       avec le meilleur score de correspondance (seuil: 25% ET ≥ 2 matches)
    3. Sur cette page, prendre la PREMIÈRE image assez grande (≥ 300×200)
    4. Déduplication cross-PDF via hash MD5
    5. Limite globale MAX_IMAGES_PER_RESPONSE partagée entre tous les PDFs

    Note : on accepte les screenshots d'interface car la documentation Cover
    est principalement constituée de captures d'écran pédagogiques.
    """
    if seen_hashes is None:
        seen_hashes = set()

    extracted_images = []

    if current_count >= MAX_IMAGES_PER_RESPONSE:
        return extracted_images

    STOP_WORDS = {
        "les", "des", "une", "pour", "dans", "sur", "avec", "par", "que",
        "qui", "est", "sont", "vous", "votre", "voici", "comment", "faire",
        "the", "and", "for", "with", "that", "this", "from", "have",
        "peut", "plus", "être", "tout", "aussi", "comme", "puis", "donc",
        "très", "bien", "alors", "après", "avant", "sous", "lors", "même",
        "cette", "cela", "ceci", "mais", "depuis", "vers", "entre",
    }

    # Mots-clés : question (priorité haute) + mots fréquents de la réponse
    q_words = re.findall(r'[a-zàâäéèêëîïôùûüç]{4,}', question_text.lower())
    q_kw = [w for w in q_words if w not in STOP_WORDS]

    a_words = re.findall(r'[a-zàâäéèêëîïôùûüç]{5,}', llm_answer.lower())
    a_kw = [w for w in a_words if w not in STOP_WORDS]
    a_counts = Counter(a_kw)
    a_top = [w for w, c in a_counts.most_common(10) if c >= 2]

    # Union ordonnée sans doublons, max 15 mots-clés
    all_kw = list(dict.fromkeys(q_kw + a_top))[:15]

    if len(all_kw) < 1:
        return []

    try:
        doc = fitz.open(pdf_path)
        unique_pages = sorted(set(page_numbers))

        # ── Trouver la page LA PLUS pertinente ────────────────────────────
        best_page_num = None
        best_score = -1.0

        for page_num in unique_pages:
            if page_num < 0 or page_num >= len(doc):
                continue
            page_text = doc[page_num].get_text("text").lower()
            matches = sum(1 for kw in all_kw if kw in page_text)
            score = matches / len(all_kw)

            # Seuil souple : 25% des mots-clés ET au moins 2 correspondances
            if score >= 0.25 and matches >= 2 and score > best_score:
                best_score = score
                best_page_num = page_num

        if best_page_num is None:
            doc.close()
            return []

        # ── Prendre la première image valide de cette page ────────────────
        page = doc[best_page_num]
        image_list = page.get_images(full=True)

        for img in image_list:
            if current_count + len(extracted_images) >= MAX_IMAGES_PER_RESPONSE:
                break
            try:
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]

                # Déduplication cross-PDF
                h = _image_hash(image_bytes)
                if h in seen_hashes:
                    continue

                pil_img = Image.open(io.BytesIO(image_bytes))
                width, height = pil_img.size

                # Ignorer icônes et décorations (< 300×200)
                if width < 300 or height < 200:
                    continue

                seen_hashes.add(h)
                extracted_images.append(image_bytes)
                break  # 1 seule image par PDF

            except Exception:
                continue

        doc.close()

    except Exception as e:
        print(f"Erreur extraction images ({os.path.basename(pdf_path)}) : {e}")

    return extracted_images


def get_source_pages_from_qa_response(qa_chain, prompt):
    sources = {}
    docs = []
    try:
        docs = qa_chain.retriever.invoke(prompt)
    except Exception:
        try:
            docs = qa_chain.retriever.get_relevant_documents(prompt)
        except Exception:
            pass

    for doc in docs:
        src = doc.metadata.get("source", "")
        page = doc.metadata.get("page", None)
        if not src.lower().endswith(".pdf") or page is None:
            continue
        candidates = [
            src,
            os.path.join(DOCS_DIR, os.path.basename(src)),
            os.path.join(DOCS_DIR, src),
            os.path.abspath(src),
            os.path.abspath(os.path.join(DOCS_DIR, os.path.basename(src))),
        ]
        for candidate in candidates:
            if os.path.exists(candidate):
                if candidate not in sources:
                    sources[candidate] = []
                sources[candidate].append(int(page))
                break

    return sources


# =====================================================
# INIT QA CHAIN
# =====================================================

@st.cache_resource(show_spinner=False)
def init_qa_chain(docs_dir: str):
    all_documents = []

    try:
        if os.path.exists(docs_dir):
            pdf_loader = DirectoryLoader(docs_dir + "/", glob="*.pdf", loader_cls=PyPDFLoader)
            pdf_docs = pdf_loader.load()
            all_documents.extend(pdf_docs)
    except Exception as e:
        st.warning(f"Erreur chargement PDF: {e}")

    if os.path.exists(docs_dir):
        excel_docs = load_excel_files(docs_dir)
        all_documents.extend(excel_docs)

    if not all_documents:
        try:
            files_in_dir = os.listdir(docs_dir) if os.path.exists(docs_dir) else []
            drive_err = st.session_state.get("_drive_error", "aucune")
            st.warning(
                f"⚠️ Aucun document chargé.\n"
                f"• Dossier : `{docs_dir}`\n"
                f"• Fichiers trouvés : {files_in_dir}\n"
                f"• Erreur Drive : {drive_err}"
            )
        except Exception:
            pass
        return None

    # APRÈS
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=50)
    chunks = text_splitter.split_documents(all_documents)

    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    vector_db = Chroma.from_documents(documents=chunks, embedding=embeddings)

    llm = ChatGroq(
        groq_api_key=api_key,
        model_name="llama-3.1-8b-instant",
        temperature=0
    )

    return RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=vector_db.as_retriever(search_kwargs={"k": 3})
    )


def get_all_brands():
    brands = set()
    if not os.path.exists(DOCS_DIR):
        return []
    for file in os.listdir(DOCS_DIR):
        if file.endswith(('.xlsx', '.xls')):
            file_path = os.path.join(DOCS_DIR, file)
            try:
                excel_data = pd.read_excel(file_path, sheet_name=None)
                for sheet_name in excel_data.keys():
                    brands.add(sheet_name.lower())
            except Exception:
                pass
    return list(brands)


def get_versions_with_urls(brand_name):
    results = []
    if not os.path.exists(DOCS_DIR):
        return []
    for file in os.listdir(DOCS_DIR):
        if file.endswith(('.xlsx', '.xls')):
            file_path = os.path.join(DOCS_DIR, file)
            try:
                excel_data = pd.read_excel(file_path, sheet_name=None)
                for sheet_name, df in excel_data.items():
                    if sheet_name.lower() != brand_name.lower():
                        continue
                    df = df.fillna("")
                    df = df.astype(str)
                    for _, row in df.iterrows():
                        row_text = " ".join([str(v) for v in row.values])
                        versions = re.findall(r'\d+\.\d+\.\d+\.\d+', row_text)
                        urls = re.findall(r'https?://[^\s]+', row_text)
                        for version in versions:
                            matched_url = "NON TROUVEE"
                            for url in urls:
                                if version in url:
                                    matched_url = url
                                    break
                            results.append({"version": version, "url": matched_url})
            except Exception:
                pass

    unique_results = []
    seen = set()
    for r in results:
        key = (r["version"], r["url"])
        if key not in seen:
            seen.add(key)
            unique_results.append(r)
    return unique_results


def get_providers_with_urls(brand_name):
    results = []
    if not os.path.exists(DOCS_DIR):
        return []
    for file in os.listdir(DOCS_DIR):
        if file.endswith(('.xlsx', '.xls')):
            file_path = os.path.join(DOCS_DIR, file)
            try:
                excel_data = pd.read_excel(file_path, sheet_name=None)
                for sheet_name, df in excel_data.items():
                    if sheet_name.lower() != brand_name.lower():
                        continue
                    df = df.fillna("")
                    df = df.astype(str)
                    for _, row in df.iterrows():
                        row_text = " ".join([str(v) for v in row.values])
                        urls = re.findall(r'https?://[^\s]+', row_text)
                        for url in urls:
                            if not re.search(r'\d+\.\d+\.\d+\.\d+', url):
                                results.append({"url": url})
            except Exception:
                pass

    unique_results = []
    seen = set()
    for r in results:
        if r["url"] not in seen:
            seen.add(r["url"])
            unique_results.append(r)
    return unique_results


def format_providers_response(brand_name, results):
    if not results:
        return f"Aucun provider trouvé pour **{brand_name}**."
    response_lines = [f"### 📋 Providers disponibles pour **{brand_name}** :"]
    for item in results:
        response_lines.append(f"- {item['url']}")
    return "\n".join(response_lines)


def search_all_providers_by_number(provider_number, specific_brand=None):
    results = []
    if not os.path.exists(DOCS_DIR):
        return results
    provider_number_str = str(provider_number)
    prov_pattern = re.compile(r'[_/]' + re.escape(provider_number_str) + r'(?:[._]\d+)?(?:\b|_|\.|/|$)')

    for file in os.listdir(DOCS_DIR):
        if file.endswith(('.xlsx', '.xls')):
            file_path = os.path.join(DOCS_DIR, file)
            try:
                excel_data = pd.read_excel(file_path, sheet_name=None)
                for sheet_name, df in excel_data.items():
                    if specific_brand and sheet_name.lower() != specific_brand.lower():
                        continue
                    df = df.fillna("")
                    df = df.astype(str)
                    for idx, row in df.iterrows():
                        for col_name, value in row.items():
                            value_str = str(value)
                            if 'http' in value_str and prov_pattern.search(value_str):
                                results.append({
                                    "marque": sheet_name,
                                    "provider_number": provider_number_str,
                                    "url": value_str
                                })
                                break
            except Exception:
                continue

    unique_results = []
    seen = set()
    for r in results:
        key = (r['marque'], r['url'])
        if key not in seen:
            seen.add(key)
            unique_results.append(r)
    return unique_results


def get_provider_number_response(provider_number, results):
    if not results:
        return f"Aucune URL trouvée pour le provider {provider_number}"

    unique_results = []
    seen = set()
    for r in results:
        key = (r['marque'], r['url'])
        if key not in seen:
            seen.add(key)
            unique_results.append(r)

    if len(unique_results) == 1:
        return unique_results[0]['url']

    response_lines = []
    for r in unique_results:
        response_lines.append(f"{r['marque']}: {r['url']}")
    return "\n".join(response_lines)


# =====================================================
# AFFICHAGE D'UN MESSAGE AVEC SES IMAGES
# =====================================================

def display_message_with_images(message):
    with st.chat_message(message["role"]):
        st.markdown(message["content"])
        images_b64 = message.get("images_b64", [])
        if images_b64:
            st.markdown("---")
            st.markdown("📸 **Illustrations issues de la documentation :**")
            for img_b64 in images_b64:
                img_bytes = base64.b64decode(img_b64)
                st.image(img_bytes, use_container_width=True)


# =====================================================
# MAIN
# =====================================================

if not api_key:
    st.error("GROQ_API_KEY non trouvée dans le fichier .env ou dans les secrets Streamlit.")
else:
    # ── 1. Télécharger les docs depuis Drive ──────────────────────────────
    docs_dir = download_docs_from_drive()

    # ── 2. Initialiser la chaîne QA avec ces docs ─────────────────────────
    qa_chain = init_qa_chain(docs_dir)

    # ── 3. Initialisation session_state ───────────────────────────────────
    defaults = {
        "messages": [],
        "pending_version": None,
        "pending_brands": [],
        "last_version": None,
        "last_brand": None,
        "pending_provider": None,
        "pending_provider_brands": [],
        "last_provider": None,
        "current_conversation_id": None,
        "last_action": None,
        "last_action_brand": None,
        "images_cache": {},
    }
    for key, val in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = val

    # =====================================================
    # SIDEBAR — HISTORIQUE
    # =====================================================
    with st.sidebar:
        st.markdown("### 💬 Historique")

        if st.button("➕ Nouvelle conversation", use_container_width=True, key="new_conv_btn"):
            new_conversation()

        st.markdown("---")

        st.markdown("### 🛠️ Actions rapides")
        if st.button("📂 Activation Licence", use_container_width=True):
            result = open_folder_and_launch()
            st.success(result["message"])

        if st.button("🔄 Réinitialiser l'assistant", use_container_width=True):
            reset_static_conversation()
            st.success("Assistant réinitialisé !")

        if st.button("🗂️ Recharger les documents Drive", use_container_width=True):
            download_docs_from_drive.clear()
            init_qa_chain.clear()
            st.rerun()

        # ── Résumé du téléchargement Drive ────────────────────────────────
        drive_summary = st.session_state.get("_drive_summary", "")
        if drive_summary:
            st.info(drive_summary)

        # ── Erreurs Drive détaillées ───────────────────────────────────────
        drive_err = st.session_state.get("_drive_error", "")
        if drive_err:
            with st.expander("⚠️ Détails erreurs Drive", expanded=False):
                st.warning(drive_err)
                st.markdown("""
**Comment corriger les erreurs 403 :**

1. **Vérifiez le partage du dossier Drive :**
   - Ouvrez Google Drive
   - Clic droit sur le dossier → "Partager"
   - Changez en **"Tout le monde avec le lien"** → Lecteur

2. **Vérifiez que les fichiers héritent des permissions :**
   - Dans Drive, les fichiers peuvent avoir des permissions indépendantes
   - Sélectionnez tous les fichiers → Partager → "Tout le monde avec le lien"

3. **Vérifiez votre clé API Google :**
   - Console Cloud → APIs & Services → Identifiants
   - L'API "Google Drive API" doit être activée
   - La clé ne doit pas avoir de restrictions d'IP bloquantes
""")

        debug_msg = st.session_state.get("_img_debug", "")
        if debug_msg:
            with st.expander("🔍 Debug images", expanded=False):
                st.text(debug_msg)

        st.markdown("---")

        conversations = get_conversations_list()

        if conversations:
            today_conv = [c for c in conversations if c["date"] == datetime.now().strftime("%Y-%m-%d")]
            if today_conv:
                st.markdown("**AUJOURD'HUI**")
                for conv in today_conv:
                    btn_label = f"💬 {conv['title']}\n🕐 {conv['time']}"
                    if st.button(btn_label, key=f"conv_today_{conv['id']}", use_container_width=True):
                        load_conversation(conv["id"])
                        st.rerun()

            older_conv = [c for c in conversations if c["date"] != datetime.now().strftime("%Y-%m-%d")]
            if older_conv:
                st.markdown("**PLUS ANCIEN**")
                for conv in older_conv:
                    btn_label = f"💬 {conv['title']}\n📅 {conv['date_formatted']}"
                    if st.button(btn_label, key=f"conv_old_{conv['id']}", use_container_width=True):
                        load_conversation(conv["id"])
                        st.rerun()
        else:
            st.info("Aucune conversation sauvegardée")

    # =====================================================
    # ZONE PRINCIPALE — CHAT
    # =====================================================
    st.title("🤖 Mon Support Assistant")

    if not st.session_state.messages:
        st.info("""💡 **Commandes :**

• **'active ma licence Cover'** → Ouvre le dossier et lance l'activation
• **'ouvre le dossier Cover'** → Ouvre l'explorateur dans C:\\Cover\\bin
• Tapez une version (ex: 1.2.3.4) → Obtenir les liens
• **'liste des versions pour [marque]'** → Affiche les versions disponibles
• **'et aussi pour [marque]'** → Enchaîne la même action pour une autre marque""")

    for message in st.session_state.messages:
        display_message_with_images(message)

    if prompt := st.chat_input("Posez votre question..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            with st.spinner("..."):

                full_response = ""
                response_images_bytes = []

                # ── PRIORITÉ 1 : Conversation statique ────────────────────
                static_response = detect_static_conversation(prompt)

                if static_response:
                    full_response = static_response

                # ── PRIORITÉ 2 : Actions Cover (Windows local) ────────────
                elif "active ma licence cover" in prompt.lower() or "active automatiquement" in prompt.lower():
                    result = open_folder_and_launch()

                    if result["folder_opened"] and result["file_launched"]:
                        full_response = f"""
### 🚀 Action effectuée avec succès !

{result["message"]}

**Ce qui vient de se passer :**
1. ✅ Dossier Cover/bin ouvert
2. ✅ licenseManager.exe lancé

Suivez les instructions à l'écran pour activer votre licence.
"""
                    elif result["folder_opened"]:
                        full_response = f"""
### ⚠️ Action partielle

{result["message"]}

Le dossier a été ouvert mais LicenceManagerBoot.exe n'a pas été trouvé.
Recherchez manuellement le fichier dans l'explorateur.
"""
                    else:
                        full_response = f"""
### ❌ Action impossible

{result["message"]}

Cover n'est pas installé dans les emplacements standards.
"""

                elif "ouvre le dossier cover" in prompt.lower():
                    success, message = open_specific_folder(r"C:\Cover\bin")
                    full_response = f"📂 {message}" if success else f"❌ {message}"

                # ── PRIORITÉ 3 : Requêtes chaînées ────────────────────────
                else:
                    chained_brand = detect_chained_request(prompt)

                    if chained_brand and st.session_state.last_action:
                        action = st.session_state.last_action

                        if action == "list_versions":
                            results_versions = get_versions_with_urls(chained_brand)
                            full_response = format_versions_response(chained_brand, results_versions)
                            st.session_state.last_action_brand = chained_brand

                        elif action == "version_url":
                            version = st.session_state.last_version
                            if version:
                                results = search_all_versions(version, chained_brand)
                                if results:
                                    full_response = f"**{chained_brand}** — version {version} :\n{get_direct_response(version, results)}"
                                else:
                                    full_response = f"Aucune URL trouvée pour la version **{version}** chez **{chained_brand}**."
                            else:
                                full_response = "Je n'ai pas de version en mémoire. Veuillez préciser la version."
                            st.session_state.last_action_brand = chained_brand

                        elif action == "list_providers":
                            results_providers = get_providers_with_urls(chained_brand)
                            full_response = format_providers_response(chained_brand, results_providers)
                            st.session_state.last_action_brand = chained_brand

                        elif action == "provider_url":
                            provider = st.session_state.last_provider
                            if provider:
                                results = search_all_providers_by_number(provider, chained_brand)
                                if results:
                                    full_response = f"**{chained_brand}** — provider {provider} :\n{get_provider_number_response(provider, results)}"
                                else:
                                    full_response = f"Aucune URL trouvée pour le provider **{provider}** chez **{chained_brand}**."
                            else:
                                full_response = "Je n'ai pas de numéro de provider en mémoire. Veuillez préciser le provider."
                            st.session_state.last_action_brand = chained_brand

                        else:
                            chained_brand = None

                    # ── Traitement normal ──────────────────────────────────
                    if not chained_brand or not st.session_state.last_action:

                        def _extract_brand(text):
                            for b in get_all_brands():
                                if b.lower() in text.lower():
                                    return b
                            return None

                        def _extract_provider_number(text):
                            if re.search(r'\d+\.\d+\.\d+\.\d+', text):
                                return None
                            m = re.search(r'\b(\d{4}\.\d{2,3})\b', text)
                            if m:
                                return m.group(1)
                            m = re.search(r'\b(\d{3,4})\b', text)
                            if m:
                                return m.group(1)
                            return None

                        def _is_provider_request(text):
                            return any(k in text.lower() for k in ["provider", "providers", "fournisseur", "fournisseurs"])

                        prompt_lower = prompt.lower()
                        version_match = re.search(r'(\d+\.\d+\.\d+\.\d+)', prompt)
                        specific_brand = _extract_brand(prompt)
                        if specific_brand:
                            st.session_state.last_brand = specific_brand
                        provider_number_match = _extract_provider_number(prompt)
                        is_provider_req = _is_provider_request(prompt)

                        if st.session_state.pending_version and not is_provider_req and not provider_number_match:
                            selected_brand = prompt.strip().lower()
                            brand_list_lower = [b.lower() for b in st.session_state.pending_brands]
                            if selected_brand in brand_list_lower:
                                results = search_all_versions(st.session_state.pending_version, selected_brand)
                                full_response = get_direct_response(st.session_state.pending_version, results)
                                st.session_state.last_action = "version_url"
                                st.session_state.last_action_brand = selected_brand
                                st.session_state.pending_version = None
                                st.session_state.pending_brands = []
                            else:
                                full_response = f"Marque non reconnue. Marques disponibles : {', '.join(st.session_state.pending_brands)}."

                        elif st.session_state.pending_provider and not provider_number_match:
                            selected_brand = prompt.strip().lower()
                            brand_list_lower = [b.lower() for b in st.session_state.pending_provider_brands]
                            if selected_brand in brand_list_lower:
                                results = search_all_providers_by_number(st.session_state.pending_provider, selected_brand)
                                full_response = get_provider_number_response(st.session_state.pending_provider, results)
                                st.session_state.last_action = "provider_url"
                                st.session_state.last_action_brand = selected_brand
                                st.session_state.pending_provider = None
                                st.session_state.pending_provider_brands = []
                            else:
                                full_response = f"Marque non reconnue. Marques disponibles : {', '.join(st.session_state.pending_provider_brands)}."

                        else:
                            if st.session_state.pending_version:
                                st.session_state.pending_version = None
                                st.session_state.pending_brands = []
                            if st.session_state.pending_provider:
                                st.session_state.pending_provider = None
                                st.session_state.pending_provider_brands = []

                            if ("liste" in prompt_lower or "versions" in prompt_lower) and not is_provider_req:
                                if specific_brand:
                                    results_versions = get_versions_with_urls(specific_brand)
                                    full_response = format_versions_response(specific_brand, results_versions)
                                    st.session_state.last_action = "list_versions"
                                    st.session_state.last_action_brand = specific_brand
                                else:
                                    full_response = "Veuillez préciser une marque pour la liste des versions."
                                    st.session_state.last_action = None

                            elif is_provider_req and specific_brand and not provider_number_match and not version_match:
                                results_providers = get_providers_with_urls(specific_brand)
                                full_response = format_providers_response(specific_brand, results_providers)
                                st.session_state.last_action = "list_providers"
                                st.session_state.last_action_brand = specific_brand

                            elif provider_number_match or (is_provider_req and provider_number_match):
                                pn = provider_number_match
                                st.session_state.last_provider = pn
                                all_results = search_all_providers_by_number(pn, specific_brand)
                                if not all_results:
                                    full_response = f"❌ Aucune URL trouvée pour le provider **{pn}**."
                                    st.session_state.last_action = None
                                else:
                                    unique_brands = list(set([r['marque'] for r in all_results]))
                                    if specific_brand or len(unique_brands) == 1:
                                        full_response = get_provider_number_response(pn, all_results)
                                        st.session_state.last_action = "provider_url"
                                        st.session_state.last_action_brand = specific_brand or unique_brands[0]
                                    else:
                                        st.session_state.pending_provider = pn
                                        st.session_state.pending_provider_brands = unique_brands
                                        st.session_state.last_action = None
                                        full_response = f"Provider **{pn}** trouvé pour plusieurs marques : {', '.join(unique_brands)}.\nPour quelle marque souhaitez-vous le lien ?"

                            elif version_match:
                                version = version_match.group(1)
                                st.session_state.last_version = version
                                all_results = search_all_versions(version, specific_brand)
                                if not all_results:
                                    if qa_chain:
                                        full_response = qa_chain.invoke(prompt)["result"]
                                    else:
                                        full_response = f"❌ Aucune URL trouvée pour la version **{version}**."
                                    st.session_state.last_action = None
                                else:
                                    unique_brands = list(set([r['marque'] for r in all_results]))
                                    if specific_brand or len(unique_brands) == 1:
                                        full_response = get_direct_response(version, all_results)
                                        st.session_state.last_action = "version_url"
                                        st.session_state.last_action_brand = specific_brand or unique_brands[0]
                                    else:
                                        st.session_state.pending_version = version
                                        st.session_state.pending_brands = unique_brands
                                        st.session_state.last_action = None
                                        full_response = f"Version **{version}** trouvée pour plusieurs marques : {', '.join(unique_brands)}.\nPour quelle marque souhaitez-vous le lien ?"

                            elif qa_chain:
                                response = qa_chain.invoke(prompt)
                                full_response = response["result"]
                                st.session_state.last_action = None

                                try:
                                    source_pages = get_source_pages_from_qa_response(qa_chain, prompt)
                                    debug_lines = [f"📂 Sources PDF trouvées : {len(source_pages)}"]

                                    # Hashs partagés entre tous les PDFs pour déduplication globale
                                    seen_hashes: set = set()

                                    for pdf_path, pages in source_pages.items():
                                        # Arrêter dès que la limite globale est atteinte
                                        if len(response_images_bytes) >= MAX_IMAGES_PER_RESPONSE:
                                            debug_lines.append(f"  ⛔ Limite globale de {MAX_IMAGES_PER_RESPONSE} images atteinte")
                                            break

                                        debug_lines.append(f"  • {os.path.basename(pdf_path)} — pages {pages}")
                                        imgs = extract_relevant_images_from_pdf(
                                            pdf_path, pages, prompt, full_response,
                                            seen_hashes=seen_hashes,
                                            current_count=len(response_images_bytes)
                                        )
                                        debug_lines.append(f"    → {len(imgs)} image(s) retenue(s)")
                                        response_images_bytes.extend(imgs)

                                    st.session_state["_img_debug"] = "\n".join(debug_lines)
                                except Exception as _e:
                                    st.session_state["_img_debug"] = f"❌ Erreur extraction: {_e}"

                            else:
                                full_response = "Aucune base de documents chargée."
                                st.session_state.last_action = None

                # ── Affichage de la réponse ────────────────────────────────
                st.markdown(full_response)

                if response_images_bytes:
                    st.markdown("---")
                    st.markdown("📸 **Illustrations issues de la documentation :**")
                    for img_bytes in response_images_bytes:
                        st.image(img_bytes, use_container_width=True)

        # ── Sauvegarde du message avec images en base64 ───────────────────
        images_b64 = [base64.b64encode(img).decode("utf-8") for img in response_images_bytes]

        st.session_state.messages.append({
            "role": "assistant",
            "content": full_response,
            "images_b64": images_b64
        })

        save_current_conversation()
        st.rerun()