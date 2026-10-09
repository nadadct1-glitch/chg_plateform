"""
Fonctions utilitaires partagées entre les routeurs : transformation des
modèles SQLAlchemy en schémas Pydantic enrichis (libellés de rôle, rangs de
progression) et petits calculs (pourcentages d'avancement, génération
d'identifiants).
"""
import re
import unicodedata

from . import models, schemas


def user_to_out(user: models.User) -> schemas.UserOut:
    meta = models.ROLE_META[user.role]
    return schemas.UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        role_label=meta["label"],
        category=meta["category"],
        rank=meta["rank"],
        rank_max=meta["rank_max"],
        full_name=user.full_name,
        phone=user.phone,
        bio=user.bio,
        photo_url=user.photo_url,
        domain_interest=user.domain_interest,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        created_at=user.created_at,
    )


def user_to_mini(user: models.User | None) -> schemas.MiniUserOut | None:
    if user is None:
        return None
    meta = models.ROLE_META[user.role]
    return schemas.MiniUserOut(
        id=user.id, full_name=user.full_name, username=user.username,
        role=user.role, role_label=meta["label"], photo_url=user.photo_url,
    )


def status_history_to_out(row: models.StatusHistory) -> schemas.StatusHistoryOut:
    return schemas.StatusHistoryOut(
        id=row.id,
        old_role=row.old_role,
        new_role=row.new_role,
        note=row.note,
        changed_at=row.changed_at,
        changed_by_name=row.changed_by.full_name if row.changed_by else None,
    )


def task_to_out(task: models.Task) -> schemas.TaskOut:
    return schemas.TaskOut(
        id=task.id, title=task.title, description=task.description, category=task.category,
        status=task.status, progress_percent=task.progress_percent,
        start_date=task.start_date, end_date=task.end_date,
        creator=user_to_mini(task.creator), assignee=user_to_mini(task.assignee),
        steps=[schemas.TaskStepOut.model_validate(s) for s in task.steps],
        created_at=task.created_at, updated_at=task.updated_at,
    )


def meeting_to_out(meeting: models.Meeting) -> schemas.MeetingOut:
    return schemas.MeetingOut(
        id=meeting.id, title=meeting.title, description=meeting.description,
        location=meeting.location, starts_at=meeting.starts_at, ends_at=meeting.ends_at,
        minutes=meeting.minutes,
        creator=user_to_mini(meeting.creator),
        participants=[
            schemas.ParticipantOut(user=user_to_mini(p.user), response=p.response)
            for p in meeting.participants
        ],
        created_at=meeting.created_at,
    )


def message_to_out(message: models.Message) -> schemas.MessageOut:
    return schemas.MessageOut(
        id=message.id, channel=message.channel, sender_id=message.sender_id,
        sender_name=message.sender.full_name if message.sender else "Utilisateur supprimé",
        sender_photo=message.sender.photo_url if message.sender else None,
        content=message.content, created_at=message.created_at,
    )


def application_to_out(app_: models.RegistrationApplication) -> schemas.ApplicationOut:
    meta = models.ROLE_META[app_.requested_role]
    return schemas.ApplicationOut(
        id=app_.id, full_name=app_.full_name, email=app_.email, phone=app_.phone,
        requested_role=app_.requested_role, role_label=meta["label"],
        domain_interest=app_.domain_interest, motivation=app_.motivation,
        status=app_.status, submitted_at=app_.submitted_at, review_note=app_.review_note,
    )


def items_progress(items: list[models.ProcessItem]) -> int:
    if not items:
        return 0
    weight = {"non_entame": 0, "en_cours": 50, "valide": 100}
    total = sum(weight[i.status.value] for i in items)
    return round(total / (len(items) * 100) * 100)


def process_item_to_out(item: models.ProcessItem) -> schemas.ProcessItemOut:
    return schemas.ProcessItemOut(
        id=item.id, number=item.number, description=item.description, status=item.status,
        assigned_to_id=item.assigned_to_id,
        assignee_name=item.assignee.full_name if item.assignee else None,
        target_date=item.target_date,
    )


def process_task_to_out(task: models.ProcessTask) -> schemas.ProcessTaskOut:
    return schemas.ProcessTaskOut(
        id=task.id, kind=task.kind, code=task.code, title=task.title,
        items=[process_item_to_out(i) for i in task.items],
        progress_percent=items_progress(task.items),
    )


def process_phase_to_out(phase: models.ProcessPhase) -> schemas.ProcessPhaseOut:
    all_items = [i for t in phase.tasks for i in t.items]
    return schemas.ProcessPhaseOut(
        id=phase.id, number=phase.number, title=phase.title,
        tasks=[process_task_to_out(t) for t in phase.tasks],
        progress_percent=items_progress(all_items),
    )


def process_section_to_out(section: models.ProcessSection) -> schemas.ProcessSectionOut:
    all_items = [i for p in section.phases for t in p.tasks for i in t.items]
    return schemas.ProcessSectionOut(
        id=section.id, code=section.code, title=section.title,
        phases=[process_phase_to_out(p) for p in section.phases],
        progress_percent=items_progress(all_items),
    )


def slugify_username(full_name: str) -> str:
    """Propose un identifiant de connexion à partir d'un nom complet (ex: 'Kodjo Mensah' -> 'kodjo.mensah')."""
    norm = unicodedata.normalize("NFKD", full_name).encode("ascii", "ignore").decode("ascii")
    norm = norm.lower().strip()
    norm = re.sub(r"[^a-z0-9]+", ".", norm).strip(".")
    return norm or "membre"


def expense_to_out(e: models.Expense) -> schemas.ExpenseOut:
    return schemas.ExpenseOut(
        id=e.id, label=e.label, category=e.category, amount=e.amount, expense_date=e.expense_date,
        note=e.note, recorded_by_name=e.recorded_by.full_name if e.recorded_by else None,
        created_at=e.created_at,
    )


def income_to_out(i: models.Income) -> schemas.IncomeOut:
    return schemas.IncomeOut(
        id=i.id, label=i.label, source=i.source, amount=i.amount, income_date=i.income_date,
        note=i.note, recorded_by_name=i.recorded_by.full_name if i.recorded_by else None,
        created_at=i.created_at,
    )
