"""
Amorçage (seed) de la base de données.

Au tout premier démarrage de l'application (quand les tables viennent
d'être créées et sont vides), cette fonction :
  1. Crée le compte administrateur initial (identifiants dans .env) ;
  2. Importe les 16 domaines d'activité et leurs spécialités ;
  3. Importe les 7 projets stratégiques ;
  4. Importe l'intégralité du processus de création du conglomérat
     (8 sections, 43 phases, 71 tâches, 333 actions) tel que décrit dans
     le Guide Opérationnel fourni ;
  5. Enregistre les textes éditables de la page d'accueil (mission, vision,
     valeurs, modules de la plateforme).

Tout est idempotent : si des données existent déjà, l'étape correspondante
est simplement ignorée (aucun doublon créé au redémarrage de l'application).
"""
import json
from pathlib import Path

from sqlalchemy.orm import Session

from . import models
from .config import settings
from .security import hash_password

DATA_DIR = Path(__file__).parent / "data"


def seed_admin(db: Session) -> None:
    if db.query(models.User).count() > 0:
        return
    admin = models.User(
        username=settings.first_admin_username,
        email=settings.first_admin_email,
        password_hash=hash_password(settings.first_admin_password),
        role=models.RoleEnum.admin,
        full_name="Administrateur de la plateforme",
        is_active=True,
        must_change_password=True,
    )
    db.add(admin)
    db.commit()
    print(f"[seed] Compte administrateur créé : {settings.first_admin_username}")


def seed_domains(db: Session) -> None:
    if db.query(models.Domain).count() > 0:
        return
    path = DATA_DIR / "domains.json"
    if not path.exists():
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    for d in data:
        domain = models.Domain(
            number=d["number"], title=d["title"], description=d.get("description") or None,
        )
        for spec_name in d.get("specialties", []):
            domain.specialties.append(models.Specialty(name=spec_name))
        db.add(domain)
    db.commit()
    print(f"[seed] {len(data)} domaines d'activité importés.")


def seed_projects(db: Session) -> None:
    if db.query(models.StrategicProject).count() > 0:
        return
    path = DATA_DIR / "projects.json"
    if not path.exists():
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    for p in data:
        db.add(models.StrategicProject(number=p["number"], title=p["title"], summary=p.get("summary") or None))
    db.commit()
    print(f"[seed] {len(data)} projets stratégiques importés.")


def seed_process(db: Session) -> None:
    if db.query(models.ProcessSection).count() > 0:
        return
    path = DATA_DIR / "process_structure.json"
    if not path.exists():
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    n_items = 0
    for s_idx, s in enumerate(data):
        section = models.ProcessSection(code=s["code"], title=s["title"], order_index=s_idx)
        for p_idx, p in enumerate(s["phases"]):
            phase = models.ProcessPhase(number=p["number"], title=p["title"], order_index=p_idx)
            for t_idx, t in enumerate(p["tasks"]):
                task = models.ProcessTask(
                    kind=t.get("kind"), code=t.get("code"), title=t["title"], order_index=t_idx,
                )
                for number, description in t["items"]:
                    task.items.append(models.ProcessItem(number=number, description=description))
                    n_items += 1
                phase.tasks.append(task)
            section.phases.append(phase)
        db.add(section)
    db.commit()
    print(f"[seed] Processus de création importé : {len(data)} sections, {n_items} actions.")


VALEURS = [
    {"title": "Excellence", "description": "Ne jamais se contenter du minimum, toujours viser la perfection dans chaque prestation."},
    {"title": "Accessibilité", "description": "Aller vers les populations, même les plus reculées, et leur apporter des services de qualité."},
    {"title": "Intégrité", "description": "Transparence totale dans toutes les transactions et relations avec les clients."},
    {"title": "Innovation", "description": "Adopter les meilleures technologies et méthodes pour servir au mieux."},
    {"title": "Solidarité", "description": "Agir pour le développement communautaire et le bien-être collectif."},
]

MODULES = [
    {"title": "Portail Client", "description": "Demande de services en ligne, suivi en temps réel et messagerie directe avec le spécialiste assigné."},
    {"title": "Espace Spécialiste", "description": "Tableau de bord personnel pour recevoir, gérer et documenter chaque mission assignée."},
    {"title": "Coordination des Travaux", "description": "Attribution des missions, calendrier interactif et alertes automatiques en cas de retard."},
    {"title": "Gestion de la Formation", "description": "Catalogue des formations, inscriptions en ligne et délivrance de certificats numériques."},
    {"title": "Gestion Administrative et Financière", "description": "Devis, factures, paiement mobile (Flooz, T-Money) et rapports financiers automatisés."},
    {"title": "Tableau de Bord Direction", "description": "Vue consolidée des activités, indicateurs de performance et cartographie des interventions."},
    {"title": "Application Mobile Grand Public", "description": "Interface simple et intuitive, géolocalisation des spécialistes et notifications en temps réel."},
]

SITE_TEXTS = {
    "org_full_name": "Conglomérat Multi-Sectoriel Concorde Holding Group (CHG)",
    "tagline": "Tous domaines. Toutes spécialités. Tous services.",
    "contact_address": "Adidogomé, Lomé - Togo",
    "contact_email": "contact@concordeholding.tg",
    "contact_phone": "",
    "intro": (
        "Le Conglomérat Multi-Sectoriel réunit, sous une seule bannière, l'ensemble des compétences, "
        "des formations et des services disponibles dans tous les secteurs d'activité de la République "
        "Togolaise. Il se positionne comme un pôle unique d'excellence : des services professionnels de "
        "haute qualité portés par des spécialistes confirmés, et des formations complètes et accessibles "
        "à toute personne désireuse d'apprendre un métier ou de se perfectionner."
    ),
    "mission": (
        "Être le partenaire de confiance de toute la population togolaise en matière de services "
        "professionnels et de formation : l'organisation de référence capable de répondre à tout besoin, "
        "dans tout domaine, avec le meilleur niveau d'excellence, coordonnée et accessible via une "
        "plateforme numérique unifiée."
    ),
    "vision": (
        "Devenir le premier et le plus grand conglomérat multi-sectoriel d'Afrique de l'Ouest, reconnu pour "
        "la qualité de ses services, l'accessibilité de ses offres, l'impact positif de ses projets sur la "
        "vie des populations, et la puissance de sa plateforme numérique de gestion des activités."
    ),
    "conclusion": (
        "En regroupant seize domaines d'activité, des centaines de spécialités et sept projets structurants, "
        "et en s'appuyant sur une Plateforme Intégrée de Gestion qui relie chaque client à chaque spécialiste "
        "en temps réel, le conglomérat s'impose comme un acteur incontournable du développement national et "
        "un modèle d'intégration multi-sectorielle pour l'Afrique de l'Ouest."
    ),
    "valeurs_json": json.dumps(VALEURS, ensure_ascii=False),
    "modules_json": json.dumps(MODULES, ensure_ascii=False),
}


def seed_site_content(db: Session) -> None:
    existing_keys = {row.key for row in db.query(models.SiteContent.key).all()}
    created = 0
    for key, value in SITE_TEXTS.items():
        if key in existing_keys:
            continue
        db.add(models.SiteContent(key=key, value=value))
        created += 1
    if created:
        db.commit()
        print(f"[seed] {created} blocs de contenu de la page d'accueil initialisés.")


def run_all_seeds(db: Session) -> None:
    seed_admin(db)
    seed_domains(db)
    seed_projects(db)
    seed_process(db)
    seed_site_content(db)
