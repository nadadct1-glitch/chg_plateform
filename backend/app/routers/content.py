from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..deps import require_admin

router = APIRouter(prefix="/api/content", tags=["Contenu vitrine"])


@router.get("/site", response_model=dict[str, str])
def get_site_content(db: Session = Depends(get_db)):
    """Textes éditables de la page d'accueil (mission, vision, valeurs...). Accès public."""
    rows = db.query(models.SiteContent).all()
    return {row.key: row.value or "" for row in rows}


@router.patch("/site/{key}", response_model=schemas.SiteContentOut)
def update_site_content(key: str, payload: schemas.SiteContentUpdate, db: Session = Depends(get_db),
                         _: models.User = Depends(require_admin)):
    row = db.query(models.SiteContent).filter(models.SiteContent.key == key).first()
    if row is None:
        row = models.SiteContent(key=key, value=payload.value)
        db.add(row)
    else:
        row.value = payload.value
    db.commit()
    db.refresh(row)
    return row


@router.get("/domains", response_model=list[schemas.DomainOut])
def list_domains(db: Session = Depends(get_db)):
    """Les 16 domaines d'activité et leurs spécialités. Accès public (page d'accueil)."""
    domains = (
        db.query(models.Domain)
        .options(joinedload(models.Domain.specialties))
        .order_by(models.Domain.number)
        .all()
    )
    return domains


@router.get("/projects", response_model=list[schemas.StrategicProjectOut])
def list_projects(db: Session = Depends(get_db)):
    """Les 7 projets stratégiques du conglomérat. Accès public (page d'accueil)."""
    return db.query(models.StrategicProject).order_by(models.StrategicProject.number).all()


@router.get("/roles")
def list_roles():
    """Référentiel des rôles/statuts (libellés, catégories, rangs) pour les listes déroulantes."""
    return [
        {"value": role.value, "label": meta["label"], "category": meta["category"],
         "rank": meta["rank"], "rank_max": meta["rank_max"]}
        for role, meta in models.ROLE_META.items()
    ]


@router.get("/categories")
def list_categories():
    return [{"value": k, "label": v} for k, v in models.CATEGORY_LABELS.items()]


@router.get("/founders", response_model=list[schemas.FounderOut])
def list_founders(db: Session = Depends(get_db)):
    """Membres fondateurs mis en avant sur la page d'accueil publique."""
    founders = (
        db.query(models.User)
        .filter(models.User.role == models.RoleEnum.fondateur, models.User.is_active.is_(True))
        .order_by(models.User.full_name)
        .all()
    )
    return [
        schemas.FounderOut(
            id=f.id, full_name=f.full_name, role_label=models.ROLE_META[f.role]["label"],
            specialty=f.domain_interest, photo_url=f.photo_url, bio=f.bio,
        )
        for f in founders
    ]
