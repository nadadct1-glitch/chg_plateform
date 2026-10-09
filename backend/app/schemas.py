"""
Schémas Pydantic : forme des données échangées avec le frontend (validation
des requêtes entrantes + structure des réponses JSON).
"""
from __future__ import annotations

import datetime as dt
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from .models import ApplicationStatusEnum, ChannelEnum, MeetingResponseEnum, RoleEnum, StatusEnum


# ---------------------------------------------------------------------------
# Authentification
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# ---------------------------------------------------------------------------
# Utilisateurs
# ---------------------------------------------------------------------------

class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    role: RoleEnum
    role_label: str
    category: str
    rank: int
    rank_max: int
    full_name: str
    phone: Optional[str] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    domain_interest: Optional[str] = None
    is_active: bool
    must_change_password: bool
    created_at: dt.datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6)
    role: RoleEnum
    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    domain_interest: Optional[str] = None

    @field_validator("username")
    @classmethod
    def username_no_spaces(cls, v: str) -> str:
        if " " in v:
            raise ValueError("L'identifiant ne doit pas contenir d'espaces")
        return v.lower()


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    domain_interest: Optional[str] = None
    is_active: Optional[bool] = None


class UserRoleUpdate(BaseModel):
    new_role: RoleEnum
    note: Optional[str] = None


class StatusHistoryOut(BaseModel):
    id: int
    old_role: Optional[RoleEnum] = None
    new_role: RoleEnum
    note: Optional[str] = None
    changed_at: dt.datetime
    changed_by_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Tâches
# ---------------------------------------------------------------------------

class TaskStepIn(BaseModel):
    title: str
    step_date: Optional[dt.date] = None
    status: StatusEnum = StatusEnum.non_entame
    order_index: int = 0


class TaskStepOut(TaskStepIn):
    id: int

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    assigned_to_id: Optional[int] = None
    start_date: Optional[dt.date] = None
    end_date: Optional[dt.date] = None
    steps: list[TaskStepIn] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[StatusEnum] = None
    progress_percent: Optional[int] = Field(default=None, ge=0, le=100)
    assigned_to_id: Optional[int] = None
    start_date: Optional[dt.date] = None
    end_date: Optional[dt.date] = None


class TaskStepUpdate(BaseModel):
    title: Optional[str] = None
    step_date: Optional[dt.date] = None
    status: Optional[StatusEnum] = None
    order_index: Optional[int] = None


class MiniUserOut(BaseModel):
    id: int
    full_name: str
    username: str
    role: RoleEnum
    role_label: str
    photo_url: Optional[str] = None

    model_config = {"from_attributes": True}


class TaskOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    status: StatusEnum
    progress_percent: int
    start_date: Optional[dt.date] = None
    end_date: Optional[dt.date] = None
    creator: Optional[MiniUserOut] = None
    assignee: Optional[MiniUserOut] = None
    steps: list[TaskStepOut] = Field(default_factory=list)
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Réunions
# ---------------------------------------------------------------------------

class MeetingCreate(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    starts_at: dt.datetime
    ends_at: Optional[dt.datetime] = None
    participant_ids: list[int] = Field(default_factory=list)


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    starts_at: Optional[dt.datetime] = None
    ends_at: Optional[dt.datetime] = None


class MeetingMinutesUpdate(BaseModel):
    minutes: str = Field(min_length=1, max_length=8000)


class ParticipantOut(BaseModel):
    user: MiniUserOut
    response: MeetingResponseEnum

    model_config = {"from_attributes": True}


class MeetingOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    starts_at: dt.datetime
    ends_at: Optional[dt.datetime] = None
    minutes: Optional[str] = None
    creator: Optional[MiniUserOut] = None
    participants: list[ParticipantOut] = Field(default_factory=list)
    created_at: dt.datetime

    model_config = {"from_attributes": True}


class ParticipantResponseUpdate(BaseModel):
    response: MeetingResponseEnum


# ---------------------------------------------------------------------------
# Messagerie
# ---------------------------------------------------------------------------

class MessageCreate(BaseModel):
    channel: ChannelEnum = ChannelEnum.general
    content: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    id: int
    channel: ChannelEnum
    sender_id: Optional[int] = None
    sender_name: Optional[str] = None
    sender_photo: Optional[str] = None
    content: str
    created_at: dt.datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Candidatures
# ---------------------------------------------------------------------------

class ApplicationCreate(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    requested_role: RoleEnum
    domain_interest: Optional[str] = None
    motivation: Optional[str] = None

    @field_validator("requested_role")
    @classmethod
    def public_roles_only(cls, v: RoleEnum) -> RoleEnum:
        allowed = {
            RoleEnum.associe, RoleEnum.associe_junior, RoleEnum.employe,
            RoleEnum.employe_junior, RoleEnum.etudiant,
        }
        if v not in allowed:
            raise ValueError("Rôle non disponible pour une candidature publique")
        return v


class ApplicationOut(BaseModel):
    id: int
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    requested_role: RoleEnum
    role_label: str
    domain_interest: Optional[str] = None
    motivation: Optional[str] = None
    status: ApplicationStatusEnum
    submitted_at: dt.datetime
    review_note: Optional[str] = None

    model_config = {"from_attributes": True}


class ApplicationApprove(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6)
    note: Optional[str] = None


class ApplicationReject(BaseModel):
    note: Optional[str] = None


# ---------------------------------------------------------------------------
# Processus de création du conglomérat
# ---------------------------------------------------------------------------

class ProcessItemUpdate(BaseModel):
    status: Optional[StatusEnum] = None
    assigned_to_id: Optional[int] = None
    target_date: Optional[dt.date] = None


class ProcessItemCreate(BaseModel):
    description: str = Field(min_length=1, max_length=2000)
    target_date: Optional[dt.date] = None
    assigned_to_id: Optional[int] = None


class ProcessTaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    kind: Optional[str] = None
    code: Optional[str] = None


class ProcessPhaseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    number: Optional[int] = None


class ProcessItemOut(BaseModel):
    id: int
    number: int
    description: str
    status: StatusEnum
    assigned_to_id: Optional[int] = None
    assignee_name: Optional[str] = None
    target_date: Optional[dt.date] = None

    model_config = {"from_attributes": True}


class ProcessTaskOut(BaseModel):
    id: int
    kind: Optional[str] = None
    code: Optional[str] = None
    title: str
    items: list[ProcessItemOut]
    progress_percent: int

    model_config = {"from_attributes": True}


class ProcessPhaseOut(BaseModel):
    id: int
    number: int
    title: str
    tasks: list[ProcessTaskOut]
    progress_percent: int

    model_config = {"from_attributes": True}


class ProcessSectionOut(BaseModel):
    id: int
    code: str
    title: str
    phases: list[ProcessPhaseOut]
    progress_percent: int

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Domaines / Projets / Contenu vitrine
# ---------------------------------------------------------------------------

class SpecialtyOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class DomainOut(BaseModel):
    id: int
    number: int
    title: str
    description: Optional[str] = None
    specialties: list[SpecialtyOut]

    model_config = {"from_attributes": True}


class StrategicProjectOut(BaseModel):
    id: int
    number: int
    title: str
    summary: Optional[str] = None

    model_config = {"from_attributes": True}


class SiteContentOut(BaseModel):
    key: str
    value: Optional[str] = None

    model_config = {"from_attributes": True}


class SiteContentUpdate(BaseModel):
    value: str


# ---------------------------------------------------------------------------
# Membres fondateurs (vitrine publique)
# ---------------------------------------------------------------------------

class FounderOut(BaseModel):
    id: int
    full_name: str
    role_label: str
    specialty: Optional[str] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None


# ---------------------------------------------------------------------------
# Finances : dépenses et entrées
# ---------------------------------------------------------------------------

class ExpenseCreate(BaseModel):
    label: str = Field(min_length=1, max_length=255)
    category: Optional[str] = None
    amount: int = Field(gt=0)
    expense_date: dt.date
    note: Optional[str] = None


class ExpenseOut(BaseModel):
    id: int
    label: str
    category: Optional[str] = None
    amount: int
    expense_date: dt.date
    note: Optional[str] = None
    recorded_by_name: Optional[str] = None
    created_at: dt.datetime

    model_config = {"from_attributes": True}


class IncomeCreate(BaseModel):
    label: str = Field(min_length=1, max_length=255)
    source: Optional[str] = None
    amount: int = Field(gt=0)
    income_date: dt.date
    note: Optional[str] = None


class IncomeOut(BaseModel):
    id: int
    label: str
    source: Optional[str] = None
    amount: int
    income_date: dt.date
    note: Optional[str] = None
    recorded_by_name: Optional[str] = None
    created_at: dt.datetime

    model_config = {"from_attributes": True}


class FinanceSummary(BaseModel):
    total_income: int
    total_expenses: int
    balance: int
    expenses_by_category: dict[str, int]
    income_by_source: dict[str, int]


# ---------------------------------------------------------------------------
# Fil d'activité (tableau de bord)
# ---------------------------------------------------------------------------

class ActivityItemOut(BaseModel):
    type: str
    icon: str
    title: str
    description: Optional[str] = None
    actor_name: Optional[str] = None
    actor_photo: Optional[str] = None
    timestamp: dt.datetime
    link: Optional[str] = None


# ---------------------------------------------------------------------------
# Tableau de bord
# ---------------------------------------------------------------------------

class DashboardStats(BaseModel):
    members_by_category: dict[str, int]
    total_members: int
    tasks_by_status: dict[str, int]
    pending_applications: int
    upcoming_meetings: int
    process_overall_percent: int


TokenOut.model_rebuild()
