from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, utils
from ..database import get_db
from ..deps import get_current_user, require_admin
from ..security import hash_password

router = APIRouter(prefix="/api/users", tags=["Utilisateurs"])


@router.get("", response_model=list[schemas.UserOut])
def list_users(
    category: Optional[str] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Annuaire des membres (fondateurs, investisseurs, partenaires, associés, employés...)."""
    query = db.query(models.User)
    if not include_inactive:
        query = query.filter(models.User.is_active.is_(True))
    users = query.order_by(models.User.full_name).all()
    out = [utils.user_to_out(u) for u in users]
    if category:
        out = [u for u in out if u.category == category]
    return out


@router.post("", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """Création directe d'un compte (dashboard admin) : identifiant + mot de passe."""
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cet identifiant est déjà utilisé.")
    user = models.User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        full_name=payload.full_name,
        phone=payload.phone,
        bio=payload.bio,
        photo_url=payload.photo_url,
        domain_interest=payload.domain_interest,
        must_change_password=True,
    )
    db.add(user)
    db.flush()
    db.add(models.StatusHistory(user_id=user.id, old_role=None, new_role=user.role,
                                 note="Création du compte"))
    db.commit()
    db.refresh(user)
    return utils.user_to_out(user)


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: int, db: Session = Depends(get_db),
             _: models.User = Depends(get_current_user)):
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Membre introuvable.")
    return utils.user_to_out(user)


@router.patch("/me", response_model=schemas.UserOut)
def update_me(
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    data = payload.model_dump(exclude_unset=True, exclude={"is_active"})
    for field, value in data.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return utils.user_to_out(current_user)


@router.patch("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Membre introuvable.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return utils.user_to_out(user)


@router.patch("/{user_id}/role", response_model=schemas.UserOut)
def change_role(
    user_id: int,
    payload: schemas.UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    """Fait évoluer le statut d'un membre (ex : associé -> associé junior) et journalise le changement."""
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Membre introuvable.")
    old_role = user.role
    user.role = payload.new_role
    db.add(models.StatusHistory(
        user_id=user.id, old_role=old_role, new_role=payload.new_role,
        note=payload.note, changed_by_id=current_user.id,
    ))
    db.commit()
    db.refresh(user)
    return utils.user_to_out(user)


@router.get("/{user_id}/history", response_model=list[schemas.StatusHistoryOut])
def user_history(user_id: int, db: Session = Depends(get_db),
                  _: models.User = Depends(get_current_user)):
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Membre introuvable.")
    return [utils.status_history_to_out(h) for h in user.status_history]


@router.get("/{user_id}/tasks", response_model=list[schemas.TaskOut])
def user_tasks(user_id: int, db: Session = Depends(get_db),
                _: models.User = Depends(get_current_user)):
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Membre introuvable.")
    tasks = (
        db.query(models.Task)
        .filter(models.Task.assigned_to_id == user_id)
        .order_by(models.Task.created_at.desc())
        .all()
    )
    return [utils.task_to_out(t) for t in tasks]
