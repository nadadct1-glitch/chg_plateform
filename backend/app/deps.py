"""
Dépendances FastAPI réutilisées par les routeurs : session DB, utilisateur
actuellement connecté (à partir du jeton JWT), et garde-fous par rôle.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)

# Rôles considérés comme "membres fondateurs" (accès au canal de discussion dédié)
FOUNDER_ROLES = {models.RoleEnum.fondateur, models.RoleEnum.admin}

# Rôles disposant de droits de gestion étendus (au même titre que l'administrateur)
STAFF_ROLES = {models.RoleEnum.admin, models.RoleEnum.fondateur}


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Identifiants invalides ou expirés, merci de vous reconnecter.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise unauthorized
    user_id = payload.get("sub")
    if user_id is None:
        raise unauthorized
    user = db.get(models.User, int(user_id))
    if user is None or not user.is_active:
        raise unauthorized
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.RoleEnum.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                             detail="Réservé à l'administration de la plateforme.")
    return user


def require_staff(user: models.User = Depends(get_current_user)) -> models.User:
    """Admin ou membre fondateur : droits de gestion (tâches, réunions, processus)."""
    if user.role not in STAFF_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                             detail="Réservé à l'administration ou aux membres fondateurs.")
    return user
