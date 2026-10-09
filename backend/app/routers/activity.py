from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/activity", tags=["Activité"])


@router.get("", response_model=list[schemas.ActivityItemOut])
def get_activity(limit: int = 20, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Fil d'actualité agrégé : arrivées/évolutions de statut, nouvelles tâches,
    réunions planifiées, candidatures reçues et derniers messages du canal général."""
    items: list[schemas.ActivityItemOut] = []
    is_staff = current_user.role in (models.RoleEnum.admin, models.RoleEnum.fondateur)

    for h in db.query(models.StatusHistory).order_by(models.StatusHistory.changed_at.desc()).limit(15):
        if h.old_role is None:
            title = f"{h.user.full_name} a rejoint le conglomérat"
            description = models.ROLE_META[h.new_role]["label"]
        else:
            title = f"{h.user.full_name} évolue de statut"
            description = f"{models.ROLE_META[h.old_role]['label']} → {models.ROLE_META[h.new_role]['label']}"
        items.append(schemas.ActivityItemOut(
            type="status", icon="members", title=title, description=description,
            actor_name=h.user.full_name, actor_photo=h.user.photo_url, timestamp=h.changed_at,
            link=f"/app/profil.html?id={h.user_id}",
        ))

    for t in db.query(models.Task).order_by(models.Task.created_at.desc()).limit(15):
        items.append(schemas.ActivityItemOut(
            type="task", icon="tasks", title=f"Nouvelle tâche : {t.title}",
            description=f"Affectée à {t.assignee.full_name}" if t.assignee else "Non affectée",
            actor_name=t.creator.full_name if t.creator else None,
            actor_photo=t.creator.photo_url if t.creator else None,
            timestamp=t.created_at, link=f"/app/tache.html?id={t.id}",
        ))

    for m in db.query(models.Meeting).order_by(models.Meeting.created_at.desc()).limit(15):
        items.append(schemas.ActivityItemOut(
            type="meeting", icon="meetings", title=f"Réunion planifiée : {m.title}",
            description=m.starts_at.strftime("%d/%m/%Y à %H:%M"),
            actor_name=m.creator.full_name if m.creator else None,
            actor_photo=m.creator.photo_url if m.creator else None,
            timestamp=m.created_at, link=f"/app/reunions.html?id={m.id}",
        ))

    if is_staff:
        for a in db.query(models.RegistrationApplication).order_by(
            models.RegistrationApplication.submitted_at.desc()
        ).limit(10):
            items.append(schemas.ActivityItemOut(
                type="application", icon="inbox", title=f"Candidature de {a.full_name}",
                description=models.ROLE_META[a.requested_role]["label"],
                actor_name=a.full_name, actor_photo=None,
                timestamp=a.submitted_at, link="/admin/candidatures.html",
            ))

    for msg in db.query(models.Message).filter(models.Message.channel == models.ChannelEnum.general).order_by(
        models.Message.created_at.desc()
    ).limit(10):
        if msg.sender is None:
            continue
        items.append(schemas.ActivityItemOut(
            type="message", icon="chat", title=f"{msg.sender.full_name} sur #Général",
            description=msg.content[:140], actor_name=msg.sender.full_name,
            actor_photo=msg.sender.photo_url, timestamp=msg.created_at, link="/app/chat.html",
        ))

    items.sort(key=lambda x: x.timestamp, reverse=True)
    return items[:limit]
