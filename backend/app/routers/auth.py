from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, utils
from ..database import get_db
from ..deps import get_current_user
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["Authentification"])


@router.post("/login", response_model=schemas.TokenOut)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == payload.username.lower()).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                             detail="Identifiant ou mot de passe incorrect.")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                             detail="Ce compte a été désactivé. Contactez l'administration.")
    token = create_access_token({"sub": str(user.id)})
    return schemas.TokenOut(access_token=token, user=utils.user_to_out(user))


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return utils.user_to_out(current_user)


@router.post("/change-password")
def change_password(
    payload: schemas.ChangePasswordRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                             detail="Le mot de passe actuel est incorrect.")
    current_user.password_hash = hash_password(payload.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"detail": "Mot de passe mis à jour."}
