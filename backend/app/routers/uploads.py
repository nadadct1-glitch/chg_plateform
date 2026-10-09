import io
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from PIL import Image

from .. import models
from ..deps import get_current_user

router = APIRouter(prefix="/api/uploads", tags=["Fichiers"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE = 5 * 1024 * 1024  # 5 Mo
MAX_DIMENSION = 640  # les photos de profil sont redimensionnées pour rester légères


@router.post("/photo")
async def upload_photo(file: UploadFile = File(...), _: models.User = Depends(get_current_user)):
    """Reçoit une photo (galerie/appareil), la redimensionne et la stocke.
    Renvoie l'URL à enregistrer comme photo_url du membre."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                             detail="Formats acceptés : JPEG, PNG, WEBP, GIF.")

    raw = await file.read()
    if len(raw) > MAX_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                             detail="Image trop volumineuse (5 Mo maximum).")

    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image invalide ou illisible.")

    filename = f"{uuid.uuid4().hex}.jpg"
    img.save(UPLOADS_DIR / filename, "JPEG", quality=88)

    return {"url": f"/uploads/{filename}"}
