import streamlit as st
import os
import re
import json
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_classic.chains import RetrievalQA
from langchain_core.documents import Document
import subprocess
import platform

# Configuration de la page
st.set_page_config(page_title="ChatBoot - Support Multi-Docs", page_icon="🤖", layout="wide")


# Chargement des variables d'environnement
load_dotenv()
api_key = os.getenv("GROQ_API_KEY")
with st.sidebar:
    # Centrer le logo avec des colonnes
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.image(r"C:\Users\zieda\OneDrive\Bureau\ChatBoot\IMG.png", width=110)
    st.markdown("---")

# =====================================================
# CONVERSATION STATIQUE POUR CHANGEMENT D'ORDINATEUR
# =====================================================

# État de la conversation statique
if "static_conversation_step" not in st.session_state:
    st.session_state.static_conversation_step = 0
if "static_conversation_active" not in st.session_state:
    st.session_state.static_conversation_active = False
if "selected_brand" not in st.session_state:
    st.session_state.selected_brand = None

# Réponses statiques prédéfinies
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
2. Cliquez sur l’onglet **“Transfer Licence”**
3. Cliquez sur **“...”** ou **“Collect Information”**
4. Choisissez :

   * le nom du fichier
   * l’emplacement où enregistrer le fichier
5. Le logiciel génère un fichier avec l’extension :

   ```text
   .id
   ```

✅ Ce fichier identifie le nouveau PC.

---

# Étape 2 : Générer le fichier de transfert `.h2h`

📍 **Sur le PC de départ (ancien PC)**

1. Copiez le fichier `.id` généré à l’étape 1 vers l’ancien PC
2. Ouvrez **RUS_COVER.exe**
3. Cliquez sur l’onglet **“Transfer Licence”**
4. Dans la liste des licences affichées :

   * recherchez la licence **Cover**
   * sélectionnez uniquement la bonne licence

⚠️ Attention :
Il peut y avoir plusieurs licences Sentinel. Vérifiez bien que vous choisissez la licence Cover.

5. Dans le premier champ :

   * sélectionnez le fichier `.id`

6. Dans le second champ :

   * choisissez l’emplacement où sera créé le fichier :

   ```text
   .h2h
   ```

7. Cliquez sur :

   ```text
   Generate Licence Transfer File
   ```

✅ Le fichier `.h2h` est alors créé.

⚠️ Important :

* la licence est automatiquement supprimée de l’ancien PC
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

3. Allez dans l’onglet :

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
# FONCTION DETECT_STATIC_CONVERSATION COMPLÈTE
# =====================================================

def detect_static_conversation(prompt):
    """Détecte si le prompt correspond à une conversation statique"""
    prompt_lower = prompt.lower()
    
    # =====================================================
    # SCÉNARIO 1: VERSION CLASSIQUE (PRIORITAIRE)
    # =====================================================
    classic_scenario = STATIC_RESPONSES.get("classic_version_install")
    if classic_scenario:
        for trigger in classic_scenario["trigger"]:
            if trigger.lower() in prompt_lower:
                st.session_state.static_conversation_active = True
                st.session_state.static_conversation_step = 1
                st.session_state.current_static_scenario = "classic_version_install"
                return classic_scenario["steps"][1]["response"]
    
    # =====================================================
    # SCÉNARIO 2: CHANGEMENT D'ORDINATEUR (START)
    # =====================================================
    for trigger in STATIC_RESPONSES["start"]["trigger"]:
        if trigger in prompt_lower:
            st.session_state.static_conversation_active = True
            st.session_state.static_conversation_step = 1
            st.session_state.current_static_scenario = "change_pc"
            return STATIC_RESPONSES["start"]["response"]
    
    if not st.session_state.static_conversation_active:
        return None
    
    # =====================================================
    # GESTION DU SCÉNARIO CLASSIC_VERSION_INSTALL
    # =====================================================
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
    
    # =====================================================
    # GESTION DU SCÉNARIO CHANGE_PC (CHANGEMENT D'ORDINATEUR)
    # =====================================================
    if st.session_state.get("current_static_scenario") == "change_pc":
        # Étape 1: Réponse oui/non pour les projets
        if st.session_state.static_conversation_step == 1:
            for trigger in STATIC_RESPONSES["ask_brand_after_yes"]["trigger"]:
                if trigger in prompt_lower:
                    st.session_state.static_conversation_step = 2
                    return STATIC_RESPONSES["ask_brand_after_yes"]["response"]
            
            for trigger in STATIC_RESPONSES["ask_brand_after_no"]["trigger"]:
                if trigger in prompt_lower:
                    st.session_state.static_conversation_step = 2
                    return STATIC_RESPONSES["ask_brand_after_no"]["response"]
        
        # Étape 2: Demande de la marque
        elif st.session_state.static_conversation_step == 2:
            # Vérifier pour Aliplast
            for trigger in STATIC_RESPONSES["aliplast_response"]["trigger"]:
                if trigger in prompt_lower:
                    st.session_state.static_conversation_step = 3
                    st.session_state.selected_brand = "Aliplast"
                    return STATIC_RESPONSES["aliplast_response"]["response"]
            
            # Vérifier pour Rideau
            for trigger in STATIC_RESPONSES["rideau_response"]["trigger"]:
                if trigger in prompt_lower:
                    st.session_state.static_conversation_step = 3
                    st.session_state.selected_brand = "Rideau"
                    return STATIC_RESPONSES["rideau_response"]["response"]
        
        # Étape 3: Confirmation de fin d'installation
        elif st.session_state.static_conversation_step == 3:
            for trigger in STATIC_RESPONSES["completion"]["trigger"]:
                if trigger in prompt_lower:
                    reset_static_conversation()
                    return STATIC_RESPONSES["completion"]["response"]
    
    return None


def reset_static_conversation():
    """Réinitialise la conversation statique"""
    st.session_state.static_conversation_active = False
    st.session_state.static_conversation_step = 0
    st.session_state.selected_brand = None
    st.session_state.current_static_scenario = None



# =====================================================
# FONCTIONS D'AUTOMATISATION
# =====================================================

def open_folder_and_launch():
    """Ouvre le dossier Cover/bin et lance LicenceManagerBoot.exe"""
    
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
    """Ouvre un dossier spécifique"""
    try:
        if os.path.exists(folder_path):
            subprocess.Popen(f'explorer "{folder_path}"', shell=True)
            return True, f"📂 Dossier ouvert : {folder_path}"
        else:
            return False, f"❌ Dossier non trouvé : {folder_path}"
    except Exception as e:
        return False, f"❌ Erreur : {e}"

def launch_specific_exe(exe_path):
    """Lance un exe spécifique"""
    try:
        if os.path.exists(exe_path):
            os.startfile(exe_path)
            return True, f"🚀 Lancement de {os.path.basename(exe_path)}"
        else:
            return False, f"❌ Fichier non trouvé : {exe_path}"
    except Exception as e:
        try:
            subprocess.Popen([exe_path], shell=True)
            return True, f"🚀 Lancement de {os.path.basename(exe_path)} (alternative)"
        except Exception as e2:
            return False, f"❌ Erreur : {e2}"

def find_all_cover_installations():
    """Trouve toutes les installations possibles de Cover"""
    installations = []
    common_paths = [
        r"C:\Cover",
        r"C:\Program Files\Cover",
        r"C:\Program Files (x86)\Cover",
        r"D:\Cover",
        r"E:\Cover"
    ]
    
    for base_path in common_paths:
        if os.path.exists(base_path):
            bin_path = os.path.join(base_path, "bin")
            if os.path.exists(bin_path):
                installations.append({
                    "base": base_path,
                    "bin": bin_path,
                    "exe": os.path.join(bin_path, "LicenseManager.exe") if os.path.exists(os.path.join(bin_path, "LicenseManager.exe")) else None
                })
    
    return installations

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
        except:
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

def new_conversation():
    clear_session()
    st.rerun()

# =====================================================
# FONCTIONS EXISTANTES (Excel)
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
    docs_dir = 'docs'
    
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
                                results.append({
                                    "marque": sheet_name,
                                    "url": url_found
                                })
                            else:
                                for col_name, value in row.items():
                                    value_str = str(value)
                                    if 'http' in value_str:
                                        url_found = value_str
                                        break
                                if url_found:
                                    results.append({
                                        "marque": sheet_name,
                                        "url": url_found
                                    })
            except Exception as e:
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

@st.cache_resource
def init_qa_chain():
    all_documents = []
    
    try:
        if os.path.exists('docs'):
            pdf_loader = DirectoryLoader('docs/', glob="*.pdf", loader_cls=PyPDFLoader)
            pdf_docs = pdf_loader.load()
            all_documents.extend(pdf_docs)
    except Exception as e:
        st.warning(f"Erreur chargement PDF: {e}")
    
    if os.path.exists('docs'):
        excel_docs = load_excel_files('docs/')
        all_documents.extend(excel_docs)
    
    if not all_documents:
        return None
    
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
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
        retriever=vector_db.as_retriever(search_kwargs={"k": 10})
    )

def get_all_brands():
    brands = set()
    docs_dir = "docs"
    if not os.path.exists(docs_dir):
        return []
    for file in os.listdir(docs_dir):
        if file.endswith(('.xlsx', '.xls')):
            file_path = os.path.join(docs_dir, file)
            try:
                excel_data = pd.read_excel(file_path, sheet_name=None)
                for sheet_name in excel_data.keys():
                    brands.add(sheet_name.lower())
            except Exception:
                pass
    return list(brands)

def get_versions_with_urls(brand_name):
    results = []
    docs_dir = "docs"
    if not os.path.exists(docs_dir):
        return []
    for file in os.listdir(docs_dir):
        if file.endswith(('.xlsx', '.xls')):
            file_path = os.path.join(docs_dir, file)
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

def search_all_providers_by_number(provider_number, specific_brand=None):
    results = []
    docs_dir = 'docs'
    if not os.path.exists(docs_dir):
        return results
    provider_number_str = str(provider_number)
    for file in os.listdir(docs_dir):
        if file.endswith(('.xlsx', '.xls')):
            file_path = os.path.join(docs_dir, file)
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
                            if 'http' in value_str and provider_number_str in value_str:
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
# MAIN
# =====================================================

if not api_key:
    st.error("GROQ_API_KEY non trouvée dans le fichier .env")

else:
    # Créer dossier docs s'il n'existe pas
    if not os.path.exists('docs'):
        os.makedirs('docs')
        st.info("📁 Dossier 'docs' créé")

    # Initialisation de la chaîne QA
    qa_chain = init_qa_chain()

    # Initialisation session_state
    if "messages" not in st.session_state:
        st.session_state.messages = []

    if "pending_version" not in st.session_state:
        st.session_state.pending_version = None

    if "pending_brands" not in st.session_state:
        st.session_state.pending_brands = []

    if "last_version" not in st.session_state:
        st.session_state.last_version = None

    if "last_brand" not in st.session_state:
        st.session_state.last_brand = None

    if "pending_provider" not in st.session_state:
        st.session_state.pending_provider = None

    if "pending_provider_brands" not in st.session_state:
        st.session_state.pending_provider_brands = []

    if "last_provider" not in st.session_state:
        st.session_state.last_provider = None

    if "current_conversation_id" not in st.session_state:
        st.session_state.current_conversation_id = None

    # =====================================================
    # SIDEBAR - HISTORIQUE
    # =====================================================
    with st.sidebar:
        st.markdown("### 💬 Historique")
        
        if st.button("➕ Nouvelle conversation", use_container_width=True, key="new_conv_btn"):
            new_conversation()
        
        st.markdown("---")
        
        # Bouton pour Cover
        st.markdown("### 🛠️ Actions rapides")
        if st.button("📂 Activation Licence", use_container_width=True):
            result = open_folder_and_launch()
            st.success(result["message"])
        
        # Bouton pour réinitialiser la conversation statique
        if st.button("🔄 Réinitialiser l'assistant", use_container_width=True):
            reset_static_conversation()
            st.success("Assistant réinitialisé !")
        
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
    # ZONE PRINCIPALE - CHAT
    # =====================================================
    st.title("🤖 Mon Support Assistant")
    
    # Afficher un message d'accueil
    if not st.session_state.messages:
        st.info("""💡 **Commandes :**


• **'active ma licence Cover'** → Ouvre le dossier et lance l'activation
• **'ouvre le dossier Cover'** → Ouvre l'explorateur dans C:\\Cover\\bin
• Tapez une version (ex: 1.2.3.4) → Obtenir les liens
• **'liste des versions pour [marque]'** → Affiche les versions disponibles""")
    
    # Affichage des messages existants
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
    
    # Barre de saisie
    if prompt := st.chat_input("Posez votre question..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            with st.spinner("..."):
                
                full_response = ""
                
                # =====================================================
                # PRIORITÉ À LA CONVERSATION STATIQUE
                # =====================================================
                static_response = detect_static_conversation(prompt)
                
                if static_response:
                    full_response = static_response
                
                # =====================================================
                # ACTIONS POUR COVER
                # =====================================================
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
                    folder_path = r"C:\Cover\bin"
                    success, message = open_specific_folder(folder_path)
                    
                    if success:
                        full_response = f"📂 {message}"
                    else:
                        full_response = f"❌ {message}"
                
                # =====================================================
                # LOGIQUE DE TRAITEMENT EXISTANTE
                # =====================================================
                elif st.session_state.pending_version:
                    selected_brand = prompt.strip().lower()
                    if selected_brand in [b.lower() for b in st.session_state.pending_brands]:
                        results = search_all_versions(st.session_state.pending_version, selected_brand)
                        full_response = get_direct_response(st.session_state.pending_version, results)
                        st.session_state.pending_version = None
                        st.session_state.pending_brands = []
                    else:
                        if qa_chain:
                            prompt_ai = f"L'utilisateur demande la marque '{prompt}'. Les marques dispo : {st.session_state.pending_brands}. Réponds que la marque n'existe pas."
                            response_ai = qa_chain.combine_documents_chain.llm_chain.llm.invoke(prompt_ai)
                            full_response = response_ai.content
                        else:
                            full_response = f"Marque non trouvée"

                elif st.session_state.pending_provider:
                    selected_brand = prompt.strip().lower()
                    if selected_brand in [b.lower() for b in st.session_state.pending_provider_brands]:
                        results = search_all_providers_by_number(st.session_state.pending_provider, selected_brand)
                        full_response = get_provider_number_response(st.session_state.pending_provider, results)
                        st.session_state.pending_provider = None
                        st.session_state.pending_provider_brands = []
                    else:
                        if qa_chain:
                            prompt_ai = f"L'utilisateur demande la marque '{prompt}'. Les marques dispo : {st.session_state.pending_provider_brands}. Réponds que la marque n'existe pas."
                            response_ai = qa_chain.combine_documents_chain.llm_chain.llm.invoke(prompt_ai)
                            full_response = response_ai.content
                        else:
                            full_response = f"Marque non trouvée"

                else:
                    version_match = re.search(r'(\d+\.\d+\.\d+\.\d+)', prompt)
                    brands = get_all_brands()
                    specific_brand = None
                    for brand in brands:
                        if brand.lower() in prompt.lower():
                            specific_brand = brand
                            st.session_state.last_brand = brand
                            break

                    provider_number_match = None
                    numbers = re.findall(r'\b(\d{3,4})\b', prompt)
                    for num in numbers:
                        if not re.search(r'\d+\.\d+\.\d+\.\d+', prompt):
                            provider_number_match = num
                            break

                    if "liste" in prompt.lower() or "versions" in prompt.lower():
                        if specific_brand:
                            results_versions = get_versions_with_urls(specific_brand)
                            if results_versions:
                                response_lines = []
                                for item in results_versions:
                                    version_value = item.get("version", "")
                                    url_value = item.get("url", "NON TROUVEE")
                                    if url_value != "NON TROUVEE":
                                        response_lines.append(f"- {version_value} : {url_value}")
                                    else:
                                        response_lines.append(f"- {version_value} : URL NON TROUVEE")
                                full_response = "\n".join(response_lines)
                            else:
                                full_response = f"Aucune version trouvée pour {specific_brand}"
                        else:
                            full_response = "Veuillez préciser une marque."

                    elif version_match:
                        version = version_match.group(1)
                        st.session_state.last_version = version
                        all_results = search_all_versions(version, specific_brand)
                        
                        if not all_results:
                            if qa_chain:
                                full_response = qa_chain.invoke(prompt)["result"]
                            else:
                                full_response = f"Aucune URL trouvée pour {version}"
                        else:
                            unique_brands = list(set([r['marque'] for r in all_results]))
                            if specific_brand or len(unique_brands) == 1:
                                full_response = get_direct_response(version, all_results)
                            else:
                                st.session_state.pending_version = version
                                st.session_state.pending_brands = unique_brands
                                if qa_chain:
                                    prompt_ai = f"La version {version} existe pour {', '.join(unique_brands)}. Demande quelle marque l'utilisateur veut."
                                    response_ai = qa_chain.combine_documents_chain.llm_chain.llm.invoke(prompt_ai)
                                    full_response = response_ai.content
                                else:
                                    full_response = f"Version {version} trouvée pour : {', '.join(unique_brands)}. Laquelle voulez-vous ?"

                    elif provider_number_match:
                        provider_number = provider_number_match
                        st.session_state.last_provider = provider_number
                        all_results = search_all_providers_by_number(provider_number, specific_brand)
                        
                        if not all_results:
                            if qa_chain:
                                full_response = qa_chain.invoke(prompt)["result"]
                            else:
                                full_response = f"Aucune URL trouvée pour provider {provider_number}"
                        else:
                            unique_brands = list(set([r['marque'] for r in all_results]))
                            if specific_brand or len(unique_brands) == 1:
                                full_response = get_provider_number_response(provider_number, all_results)
                            else:
                                st.session_state.pending_provider = provider_number
                                st.session_state.pending_provider_brands = unique_brands
                                if qa_chain:
                                    prompt_ai = f"Provider {provider_number} existe pour {', '.join(unique_brands)}. Demande quelle marque."
                                    response_ai = qa_chain.combine_documents_chain.llm_chain.llm.invoke(prompt_ai)
                                    full_response = response_ai.content
                                else:
                                    full_response = f"Provider {provider_number} trouvé pour : {', '.join(unique_brands)}. Laquelle ?"

                    elif qa_chain:
                        response = qa_chain.invoke(prompt)
                        full_response = response["result"]
                    else:
                        full_response = "Aucune base de documents"

                # Afficher la réponse
                st.markdown(full_response)

        # Ajouter la réponse à l'historique
        st.session_state.messages.append({"role": "assistant", "content": full_response})
        
        # Sauvegarde automatique
        save_current_conversation()
        
        st.rerun()