"""
Modèles de données SQLAlchemy pour la plateforme CHG (Concorde Holding Group).

Toutes les tables de la base de données sont définies ICI, en Python. Au
premier lancement de l'application, `Base.metadata.create_all(engine)` (voir
app/main.py) crée automatiquement l'ensemble de ces tables dans PostgreSQL
si elles n'existent pas encore -- aucune commande SQL manuelle n'est requise.
"""
import datetime as dt
import enum

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


def utcnow() -> dt.datetime:
    return dt.datetime.utcnow()


# ---------------------------------------------------------------------------
# Énumérations
# ---------------------------------------------------------------------------

class RoleEnum(str, enum.Enum):
    admin = "admin"
    fondateur = "fondateur"
    investisseur = "investisseur"
    partenaire = "partenaire"
    associe_senior = "associe_senior"
    associe_junior = "associe_junior"
    associe = "associe"
    employe_senior = "employe_senior"
    employe_junior = "employe_junior"
    employe = "employe"
    etudiant = "etudiant"


# Métadonnées descriptives par rôle : libellé affiché, catégorie de
# regroupement (annuaire des membres) et rang utilisé pour la barre de
# progression d'évolution de statut sur le profil.
ROLE_META: dict[RoleEnum, dict] = {
    RoleEnum.admin: {"label": "Administrateur", "category": "administration", "rank": 1, "rank_max": 1},
    RoleEnum.fondateur: {"label": "Membre Fondateur", "category": "direction", "rank": 1, "rank_max": 1},
    RoleEnum.investisseur: {"label": "Investisseur", "category": "investisseur", "rank": 1, "rank_max": 1},
    RoleEnum.partenaire: {"label": "Partenaire", "category": "partenaire", "rank": 1, "rank_max": 1},
    RoleEnum.associe_senior: {"label": "Associé Senior", "category": "associe", "rank": 3, "rank_max": 3},
    RoleEnum.associe_junior: {"label": "Associé Junior", "category": "associe", "rank": 2, "rank_max": 3},
    RoleEnum.associe: {"label": "Associé", "category": "associe", "rank": 1, "rank_max": 3},
    RoleEnum.employe_senior: {"label": "Employé Senior", "category": "employe", "rank": 3, "rank_max": 3},
    RoleEnum.employe_junior: {"label": "Employé Junior", "category": "employe", "rank": 2, "rank_max": 3},
    RoleEnum.employe: {"label": "Employé", "category": "employe", "rank": 1, "rank_max": 3},
    RoleEnum.etudiant: {"label": "Étudiant / Stagiaire", "category": "etudiant", "rank": 0, "rank_max": 3},
}

CATEGORY_LABELS = {
    "administration": "Administration",
    "direction": "Membres Fondateurs",
    "investisseur": "Investisseurs",
    "partenaire": "Partenaires",
    "associe": "Associés",
    "employe": "Employés",
    "etudiant": "Étudiants / Stagiaires",
}


class StatusEnum(str, enum.Enum):
    non_entame = "non_entame"  # rouge
    en_cours = "en_cours"      # orange
    valide = "valide"          # vert


class ApplicationStatusEnum(str, enum.Enum):
    en_attente = "en_attente"
    approuvee = "approuvee"
    rejetee = "rejetee"


class MeetingResponseEnum(str, enum.Enum):
    en_attente = "en_attente"
    accepte = "accepte"
    decline = "decline"


class ChannelEnum(str, enum.Enum):
    fondateurs = "fondateurs"
    general = "general"


# ---------------------------------------------------------------------------
# Utilisateurs & évolution de statut
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum, name="role_enum"), nullable=False, default=RoleEnum.employe)

    full_name = Column(String(150), nullable=False)
    phone = Column(String(40), nullable=True)
    bio = Column(Text, nullable=True)
    photo_url = Column(String(500), nullable=True)
    domain_interest = Column(String(150), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    must_change_password = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    status_history = relationship(
        "StatusHistory", back_populates="user", foreign_keys="StatusHistory.user_id",
        cascade="all, delete-orphan", order_by="StatusHistory.changed_at",
    )
    tasks_assigned = relationship("Task", back_populates="assignee", foreign_keys="Task.assigned_to_id")
    tasks_created = relationship("Task", back_populates="creator", foreign_keys="Task.created_by_id")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    old_role = Column(Enum(RoleEnum, name="role_enum"), nullable=True)
    new_role = Column(Enum(RoleEnum, name="role_enum"), nullable=False)
    note = Column(String(500), nullable=True)
    changed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    changed_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User", back_populates="status_history", foreign_keys=[user_id])
    changed_by = relationship("User", foreign_keys=[changed_by_id])


# ---------------------------------------------------------------------------
# Tâches (affectées aux fondateurs / associés / employés)
# ---------------------------------------------------------------------------

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)

    status = Column(Enum(StatusEnum, name="status_enum"), nullable=False, default=StatusEnum.non_entame)
    progress_percent = Column(Integer, nullable=False, default=0)

    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    creator = relationship("User", back_populates="tasks_created", foreign_keys=[created_by_id])
    assignee = relationship("User", back_populates="tasks_assigned", foreign_keys=[assigned_to_id])
    steps = relationship(
        "TaskStep", back_populates="task", cascade="all, delete-orphan", order_by="TaskStep.order_index"
    )


class TaskStep(Base):
    """Une étape du calendrier de déroulement d'une tâche (début, étapes, fin)."""
    __tablename__ = "task_steps"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    step_date = Column(Date, nullable=True)
    status = Column(Enum(StatusEnum, name="status_enum"), nullable=False, default=StatusEnum.non_entame)
    order_index = Column(Integer, nullable=False, default=0)

    task = relationship("Task", back_populates="steps")


# ---------------------------------------------------------------------------
# Réunions
# ---------------------------------------------------------------------------

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=True)
    minutes = Column(Text, nullable=True)  # grandes lignes / compte-rendu de la réunion
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    creator = relationship("User", foreign_keys=[created_by_id])
    participants = relationship(
        "MeetingParticipant", back_populates="meeting", cascade="all, delete-orphan"
    )


class MeetingParticipant(Base):
    __tablename__ = "meeting_participants"
    __table_args__ = (UniqueConstraint("meeting_id", "user_id", name="uq_meeting_user"),)

    id = Column(Integer, primary_key=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    response = Column(
        Enum(MeetingResponseEnum, name="meeting_response_enum"),
        nullable=False, default=MeetingResponseEnum.en_attente,
    )

    meeting = relationship("Meeting", back_populates="participants")
    user = relationship("User")


# ---------------------------------------------------------------------------
# Messagerie interne (canaux)
# ---------------------------------------------------------------------------

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    channel = Column(Enum(ChannelEnum, name="channel_enum"), nullable=False, default=ChannelEnum.general)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)

    sender = relationship("User")


# ---------------------------------------------------------------------------
# Candidatures d'inscription (associés / employés / étudiants)
# ---------------------------------------------------------------------------

class RegistrationApplication(Base):
    __tablename__ = "registration_applications"

    id = Column(Integer, primary_key=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(40), nullable=True)
    requested_role = Column(Enum(RoleEnum, name="role_enum"), nullable=False)
    domain_interest = Column(String(150), nullable=True)
    motivation = Column(Text, nullable=True)
    status = Column(
        Enum(ApplicationStatusEnum, name="application_status_enum"),
        nullable=False, default=ApplicationStatusEnum.en_attente,
    )
    submitted_at = Column(DateTime, default=utcnow, nullable=False)
    reviewed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(String(500), nullable=True)
    created_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    created_user = relationship("User", foreign_keys=[created_user_id])


# ---------------------------------------------------------------------------
# Processus de création du conglomérat : Section > Phase > Tâche > Item
# (contenu initial importé depuis le Guide Opérationnel fourni)
# ---------------------------------------------------------------------------

class ProcessSection(Base):
    __tablename__ = "process_sections"

    id = Column(Integer, primary_key=True)
    code = Column(String(10), nullable=False)
    title = Column(String(255), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)

    phases = relationship(
        "ProcessPhase", back_populates="section", cascade="all, delete-orphan",
        order_by="ProcessPhase.order_index",
    )


class ProcessPhase(Base):
    __tablename__ = "process_phases"

    id = Column(Integer, primary_key=True)
    section_id = Column(Integer, ForeignKey("process_sections.id", ondelete="CASCADE"), nullable=False)
    number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)

    section = relationship("ProcessSection", back_populates="phases")
    tasks = relationship(
        "ProcessTask", back_populates="phase", cascade="all, delete-orphan",
        order_by="ProcessTask.order_index",
    )


class ProcessTask(Base):
    __tablename__ = "process_tasks"

    id = Column(Integer, primary_key=True)
    phase_id = Column(Integer, ForeignKey("process_phases.id", ondelete="CASCADE"), nullable=False)
    kind = Column(String(30), nullable=True)
    code = Column(String(20), nullable=True)
    title = Column(String(255), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)

    phase = relationship("ProcessPhase", back_populates="tasks")
    items = relationship(
        "ProcessItem", back_populates="task", cascade="all, delete-orphan", order_by="ProcessItem.number"
    )


class ProcessItem(Base):
    __tablename__ = "process_items"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("process_tasks.id", ondelete="CASCADE"), nullable=False)
    number = Column(Integer, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(Enum(StatusEnum, name="status_enum"), nullable=False, default=StatusEnum.non_entame)
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    target_date = Column(Date, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    task = relationship("ProcessTask", back_populates="items")
    assignee = relationship("User")


# ---------------------------------------------------------------------------
# Contenu vitrine : domaines d'activité, projets stratégiques, textes éditables
# ---------------------------------------------------------------------------

class Domain(Base):
    __tablename__ = "domains"

    id = Column(Integer, primary_key=True)
    number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    specialties = relationship(
        "Specialty", back_populates="domain", cascade="all, delete-orphan", order_by="Specialty.id"
    )


class Specialty(Base):
    __tablename__ = "specialties"

    id = Column(Integer, primary_key=True)
    domain_id = Column(Integer, ForeignKey("domains.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)

    domain = relationship("Domain", back_populates="specialties")


class StrategicProject(Base):
    __tablename__ = "strategic_projects"

    id = Column(Integer, primary_key=True)
    number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=True)


class SiteContent(Base):
    """Paire clé/valeur éditable depuis le dashboard admin (mission, vision...)."""
    __tablename__ = "site_content"

    id = Column(Integer, primary_key=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


# ---------------------------------------------------------------------------
# Finances : dépenses et entrées financières (gestion administrative)
# ---------------------------------------------------------------------------

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True)
    label = Column(String(255), nullable=False)
    category = Column(String(120), nullable=True)
    amount = Column(Integer, nullable=False)  # montant en FCFA (entier, pas de sous-unité)
    expense_date = Column(Date, nullable=False)
    note = Column(Text, nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    recorded_by = relationship("User", foreign_keys=[recorded_by_id])


class Income(Base):
    __tablename__ = "incomes"

    id = Column(Integer, primary_key=True)
    label = Column(String(255), nullable=False)
    source = Column(String(120), nullable=True)
    amount = Column(Integer, nullable=False)  # montant en FCFA
    income_date = Column(Date, nullable=False)
    note = Column(Text, nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    recorded_by = relationship("User", foreign_keys=[recorded_by_id])


# ---------------------------------------------------------------------------
# Membres fondateurs mis en avant sur la page d'accueil publique
# ---------------------------------------------------------------------------
# (Pas de table dédiée : la page d'accueil publique affiche simplement les
# utilisateurs actifs de rôle "fondateur" -- voir routers/content.py.
# Nom, rôle, spécialité (domain_interest) et photo sont déjà des champs de
# la table users, remplis depuis Admin > Utilisateurs.)
