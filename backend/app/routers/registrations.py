import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, utils
from ..database import get_db
from ..deps import require_admin
from ..security import hash_password

router = APIRouter(prefix="/api/registrations", tags=["Candidatures"])


@router.post("", response_model=schemas.ApplicationOut, status_code=status.HTTP_201_CREATED)
def submit_application(payload: schemas.ApplicationCreate, db: Session = Depends(get_db)):
    """Formulaire public : un futur associé, employé ou étudiant dépose sa candidature."""
    application = models.RegistrationApplication(
        full_name=payload.full_name, email=payload.email, phone=payload.phone,
        requested_role=payload.requested_role, domain_interest=payload.domain_interest,
        motivation=payload.motivation,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return utils.application_to_out(application)


@router.get("", response_model=list[schemas.ApplicationOut])
def list_applications(
    status_filter: Optional[models.ApplicationStatusEnum] = None,
    db: Session = Depends(get_db), _: models.User = Depends(require_admin),
):
    query = db.query(models.RegistrationApplication)
    if status_filter is not None:
        query = query.filter(models.RegistrationApplication.status == status_filter)
    apps = query.order_by(models.RegistrationApplication.submitted_at.desc()).all()
    return [utils.application_to_out(a) for a in apps]


@router.get("/{application_id}", response_model=schemas.ApplicationOut)
def get_application(application_id: int, db: Session = Depends(get_db),
                     _: models.User = Depends(require_admin)):
    application = db.get(models.RegistrationApplication, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Candidature introuvable.")
    return utils.application_to_out(application)


@router.post("/{application_id}/approve", response_model=schemas.UserOut)
def approve_application(
    application_id: int, payload: schemas.ApplicationApprove,
    db: Session = Depends(get_db), current_user: models.User = Depends(require_admin),
):
    """Valide la candidature : crée le compte (identifiant + mot de passe définis ici)."""
    application = db.get(models.RegistrationApplication, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Candidature introuvable.")
    if application.status != models.ApplicationStatusEnum.en_attente:
        raise HTTPException(status_code=400, detail="Cette candidature a déjà été traitée.")
    if db.query(models.User).filter(models.User.username == payload.username.lower()).first():
        raise HTTPException(status_code=409, detail="Cet identifiant est déjà utilisé.")

    user = models.User(
        username=payload.username.lower(), email=application.email,
        password_hash=hash_password(payload.password), role=application.requested_role,
        full_name=application.full_name, phone=application.phone,
        domain_interest=application.domain_interest, must_change_password=True,
    )
    db.add(user)
    db.flush()
    db.add(models.StatusHistory(user_id=user.id, old_role=None, new_role=user.role,
                                 note="Compte créé suite à candidature validée",
                                 changed_by_id=current_user.id))
    application.status = models.ApplicationStatusEnum.approuvee
    application.reviewed_by_id = current_user.id
    application.reviewed_at = dt.datetime.utcnow()
    application.review_note = payload.note
    application.created_user_id = user.id
    db.commit()
    db.refresh(user)
    return utils.user_to_out(user)


@router.post("/{application_id}/reject", response_model=schemas.ApplicationOut)
def reject_application(
    application_id: int, payload: schemas.ApplicationReject,
    db: Session = Depends(get_db), current_user: models.User = Depends(require_admin),
):
    application = db.get(models.RegistrationApplication, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Candidature introuvable.")
    application.status = models.ApplicationStatusEnum.rejetee
    application.reviewed_by_id = current_user.id
    application.reviewed_at = dt.datetime.utcnow()
    application.review_note = payload.note
    db.commit()
    db.refresh(application)
    return utils.application_to_out(application)
