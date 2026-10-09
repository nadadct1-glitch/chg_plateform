from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, utils
from ..database import get_db
from ..deps import FOUNDER_ROLES, get_current_user

router = APIRouter(prefix="/api/chat", tags=["Messagerie"])


def _ensure_channel_access(channel: models.ChannelEnum, user: models.User) -> None:
    if channel == models.ChannelEnum.fondateurs and user.role not in FOUNDER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                             detail="Ce canal est réservé aux membres fondateurs.")


@router.get("/{channel}", response_model=list[schemas.MessageOut])
def get_messages(
    channel: models.ChannelEnum, after_id: int = 0, limit: int = 200,
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user),
):
    _ensure_channel_access(channel, current_user)
    messages = (
        db.query(models.Message)
        .filter(models.Message.channel == channel, models.Message.id > after_id)
        .order_by(models.Message.id.asc())
        .limit(limit)
        .all()
    )
    return [utils.message_to_out(m) for m in messages]


@router.post("/{channel}", response_model=schemas.MessageOut, status_code=status.HTTP_201_CREATED)
def post_message(
    channel: models.ChannelEnum, payload: schemas.MessageCreate,
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user),
):
    _ensure_channel_access(channel, current_user)
    message = models.Message(channel=channel, sender_id=current_user.id, content=payload.content.strip())
    db.add(message)
    db.commit()
    db.refresh(message)
    return utils.message_to_out(message)
