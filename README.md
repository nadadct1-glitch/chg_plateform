# Plateforme CHG — Concorde Holding Group

Plateforme Intégrée de Gestion du conglomérat multi-sectoriel **Concorde
Holding Group (CHG)** : page d'accueil publique avec bannière animée et mise
en avant des membres fondateurs, tableau de bord en colonnes (tâches et
réunions, fil d'actualité, contenus en vedette, panneau des membres),
processus de création détaillé étape par étape (entièrement gérable depuis
l'interface), annuaire des membres (fondateurs, investisseurs, partenaires,
associés, employés), gestion des tâches avec calendrier et barre de
progression, réunions avec compte-rendu, messagerie interne, suivi financier
(dépenses / entrées), et inscriptions des futurs associés / employés /
étudiants.

- **Backend** : Python, FastAPI, SQLAlchemy
- **Base de données** : PostgreSQL (toutes les tables sont créées automatiquement
  au premier lancement, directement depuis le code Python — aucun script SQL à
  exécuter à la main)
- **Frontend** : HTML / CSS / JavaScript natif (aucun framework), en Progressive
  Web App (installable sur mobile et ordinateur, avec icône et mode hors-ligne
  partiel pour l'interface)

---

## 1. Prérequis

- Python 3.11 ou plus récent
- PostgreSQL 14 ou plus récent (installé et démarré)

## 2. Installation

### 2.1. Créer la base de données PostgreSQL

```bash
sudo -u postgres psql -c "CREATE USER chg_user WITH PASSWORD 'chg_password';"
sudo -u postgres psql -c "CREATE DATABASE chg_platform OWNER chg_user;"
```

(Adaptez le nom d'utilisateur / mot de passe / base si vous préférez — voir
l'étape 2.3.)

### 2.2. Installer les dépendances Python

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows : venv\Scripts\activate
pip install -r requirements.txt
```

### 2.3. Configurer les variables d'environnement (optionnel mais recommandé)

```bash
cp .env.example .env
```

Puis modifiez `.env` si besoin (adresse de la base de données, clé secrète,
identifiants du premier compte administrateur...). Si vous ne créez pas de
fichier `.env`, l'application utilise les valeurs par défaut définies dans
`app/config.py`, qui correspondent exactement aux identifiants créés à
l'étape 2.1.

### 2.4. Premier lancement

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8088
```

Au tout premier démarrage, l'application :
1. crée automatiquement l'ensemble des tables dans PostgreSQL ;
2. crée le compte administrateur initial (voir `.env` / `.env.example`,
   par défaut identifiant `admin`, mot de passe `ChangeMoi123!`) ;
3. importe le contenu réel fourni : les 16 domaines d'activité, les 7 projets
   stratégiques, et l'intégralité du processus de création du conglomérat
   (8 sections, 43 phases, 71 tâches, **333 actions détaillées**) tel que
   décrit dans le Guide Opérationnel.

Ouvrez ensuite **http://localhost:8088** dans votre navigateur. La page
d'accueil publique s'affiche ; connectez-vous depuis "Se connecter" avec le
compte administrateur pour accéder au tableau de bord complet.

**⚠️ Pensez à changer le mot de passe administrateur dès la première connexion**
(page Paramètres), ou à le modifier dans `.env` avant le tout premier lancement.

---

## 3. Structure du projet

```
chg-platform/
├── backend/
│   ├── app/
│   │   ├── main.py           # point d'entrée FastAPI, création des tables, montage du frontend
│   │   ├── config.py         # configuration (variables d'environnement)
│   │   ├── database.py       # connexion SQLAlchemy / PostgreSQL
│   │   ├── models.py         # toutes les tables de la base de données
│   │   ├── schemas.py        # schémas de validation / réponses (Pydantic)
│   │   ├── security.py       # hachage des mots de passe, jetons JWT
│   │   ├── deps.py           # dépendances d'authentification et de rôles
│   │   ├── utils.py          # fonctions de sérialisation partagées
│   │   ├── seed_data.py      # import du contenu initial (domaines, projets, processus)
│   │   ├── data/*.json       # contenu structuré extrait des documents fournis
│   │   └── routers/          # les routes de l'API (auth, users, tasks, meetings, chat...)
│   ├── requirements.txt
│   ├── .env.example
│   └── test_e2e.py           # script de test de bout en bout (optionnel)
└── frontend/
    ├── index.html             # page d'accueil publique (présentation du conglomérat)
    ├── login.html              # connexion
    ├── rejoindre.html          # candidature publique (associés / employés / étudiants)
    ├── app/                    # espace connecté (tous les membres)
    ├── admin/                  # tableau de bord administrateur
    ├── css/style.css           # système de design complet
    ├── js/                     # logique JavaScript (un fichier par page + utilitaires partagés)
    ├── manifest.json / service-worker.js / icons/   # Progressive Web App
    └── assets/logo-chg.png
```

## 4. Comptes et rôles

Onze statuts sont disponibles : `admin`, `fondateur`, `investisseur`,
`partenaire`, `associe_senior`, `associe_junior`, `associe`,
`employe_senior`, `employe_junior`, `employe`, `etudiant`.

- **L'administrateur** crée les comptes (identifiant + mot de passe) depuis
  *Admin → Utilisateurs*, ou approuve les candidatures publiques depuis
  *Admin → Candidatures* (ce qui crée le compte automatiquement).
- Chaque changement de statut (ex. *associé* → *associé junior*) est
  enregistré dans un historique visible sur le profil du membre, avec une
  barre de progression.
- Le canal de discussion **« Fondateurs »** n'est visible que par les
  membres fondateurs et l'administrateur ; le canal **« Général »** est
  ouvert à tous.
- Les tâches et les actions du processus de création affichent toujours une
  barre de progression et un statut coloré : **rouge** = non entamé,
  **orange** = en cours, **vert** = validé.

## 5. Notes de conception / limites connues

- **Thèmes visuels** : la page d'accueil publique (`/index.html`) utilise un
  thème crème avec cartes sombres contrastées ; le tableau de bord et toutes
  les pages d'administration (`/app/accueil.html` et `/admin/*.html`)
  utilisent un thème clair uniforme ; le reste de l'application (connexion,
  Membres, Tâches, Processus, Réunions, Discussion, Profil, Paramètres)
  garde le thème sombre d'origine. La barre latérale et la barre de
  navigation basse restent toujours sombres sur toutes les pages. Le fil
  d'actualité du tableau de bord agrège automatiquement les arrivées de
  membres, évolutions de statut, nouvelles tâches, réunions planifiées et
  derniers messages du canal général (aucune saisie manuelle requise).
- Le logo utilisé dans toute l'application (`frontend/assets/logo-chg.png`)
  est en fond transparent ; les icônes PWA (`frontend/icons/`) sont générées
  à partir de ce même fichier, avec un fond uni ajouté pour les contextes où
  une icône d'application a besoin d'un arrière-plan plein.
- Depuis la page d'accueil, chaque domaine d'activité renvoie vers le
  formulaire de candidature avec le domaine déjà pré-rempli.
- Les domaines d'activité et projets stratégiques sont modifiables au
  niveau de leurs textes (page *Admin → Contenu du site*) ; l'ajout ou la
  suppression d'un domaine/projet dans la liste elle-même nécessite pour
  l'instant une intervention en base de données (l'API ne l'expose pas
  encore, afin de garder la structure fidèle au document de référence).
  Les phases, tâches et actions du **processus de création**, elles, sont
  entièrement gérables depuis la page *Processus* (bouton "+" visible par
  l'administrateur à chaque niveau, avec suppression possible).
- La messagerie fonctionne par rafraîchissement automatique (toutes les
  4 secondes), pas par WebSocket : plus simple à déployer, au prix d'un
  léger délai d'affichage des nouveaux messages.
- Les photos de profil se téléversent directement depuis la galerie/l'appareil
  lors de la création d'un membre (formulaire "Nouveau membre", pages Membres
  et Admin → Utilisateurs). Les fichiers sont redimensionnés automatiquement
  (5 Mo maximum, JPEG/PNG/WEBP/GIF acceptés) et stockés dans `backend/uploads/`,
  servi par l'API sous `/uploads/...` — ce dossier n'a besoin d'aucune
  configuration, il est créé automatiquement au premier lancement.
- La bannière de la page d'accueil est composée d'illustrations vectorielles
  générées directement dans le code (pas de photos externes), pour que le
  site reste toujours fiable et cohérent avec la charte graphique, sans
  dépendre d'un service tiers ni poser de question de droits d'image.
- Les montants (Finances) sont enregistrés en FCFA, sans sous-unité.
- Le mode hors-ligne du PWA couvre l'interface (pages, styles, scripts) mais
  pas les données, qui nécessitent toujours une connexion à l'API.

## 6. Mise à jour d'une installation existante

Si vous avez déjà déployé une version précédente de la plateforme, il
suffit de remplacer les dossiers `backend/app` et `frontend`, puis de
redémarrer le serveur (`uvicorn ...`). Au redémarrage, l'application ajoute
automatiquement les nouvelles tables (Dépenses, Entrées) et la nouvelle
colonne "compte-rendu" sur les réunions, **sans toucher à vos données
existantes**. Aucune autre manipulation n'est nécessaire.

## 7. Tester l'installation (optionnel)

Un script de test de bout en bout est fourni pour vérifier qu'une
installation fonctionne correctement (authentification, tâches, processus,
candidatures, messagerie, réunions...) :

```bash
cd backend
pip install requests
python test_e2e.py     # le serveur doit être démarré (uvicorn ...) au préalable
```
