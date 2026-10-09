import datetime as dt

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_staff
from ..utils import items_progress

router = APIRouter(prefix="/api/dashboard", tags=["Tableau de bord"])


@router.get("", response_model=schemas.DashboardStats)
def get_dashboard(db: Session = Depends(get_db), _: models.User = Depends(require_staff)):
    members_by_category: dict[str, int] = {cat: 0 for cat in models.CATEGORY_LABELS}
    for role, count in db.query(models.User.role, func.count(models.User.id)).filter(
        models.User.is_active.is_(True)
    ).group_by(models.User.role).all():
        cat = models.ROLE_META[role]["category"]
        members_by_category[cat] = members_by_category.get(cat, 0) + count

    tasks_by_status = {s.value: 0 for s in models.StatusEnum}
    for status_value, count in db.query(models.Task.status, func.count(models.Task.id)).group_by(
        models.Task.status
    ).all():
        tasks_by_status[status_value.value] = count

    pending_applications = db.query(models.RegistrationApplication).filter(
        models.RegistrationApplication.status == models.ApplicationStatusEnum.en_attente
    ).count()

    upcoming_meetings = db.query(models.Meeting).filter(
        models.Meeting.starts_at >= dt.datetime.utcnow()
    ).count()

    all_items = db.query(models.ProcessItem).all()
    process_overall_percent = items_progress(all_items)

    return schemas.DashboardStats(
        members_by_category=members_by_category,
        total_members=sum(members_by_category.values()),
        tasks_by_status=tasks_by_status,
        pending_applications=pending_applications,
        upcoming_meetings=upcoming_meetings,
        process_overall_percent=process_overall_percent,
    )
