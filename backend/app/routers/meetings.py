from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, utils
from ..database import get_db
from ..deps import get_current_user, require_staff

router = APIRouter(prefix="/api/meetings", tags=["Réunions"])


@router.get("", response_model=list[schemas.MeetingOut])
def list_meetings(upcoming_only: bool = False, db: Session = Depends(get_db),
                   _: models.User = Depends(get_current_user)):
    query = db.query(models.Meeting)
    if upcoming_only:
        import datetime as dt
        query = query.filter(models.Meeting.starts_at >= dt.datetime.utcnow())
    meetings = query.order_by(models.Meeting.starts_at.asc()).all()
    return [utils.meeting_to_out(m) for m in meetings]


@router.post("", response_model=schemas.MeetingOut, status_code=status.HTTP_201_CREATED)
def create_meeting(payload: schemas.MeetingCreate, db: Session = Depends(get_db),
                    current_user: models.User = Depends(require_staff)):
    meeting = models.Meeting(
        title=payload.title, description=payload.description, location=payload.location,
        starts_at=payload.starts_at, ends_at=payload.ends_at, created_by_id=current_user.id,
    )
    participant_ids = set(payload.participant_ids) | {current_user.id}
    for uid in participant_ids:
        if db.get(models.User, uid):
            meeting.participants.append(models.MeetingParticipant(user_id=uid))
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return utils.meeting_to_out(meeting)


@router.get("/{meeting_id}", response_model=schemas.MeetingOut)
def get_meeting(meeting_id: int, db: Session = Depends(get_db),
                 _: models.User = Depends(get_current_user)):
    meeting = db.get(models.Meeting, meeting_id)
    if meeting is None:
        raise HTTPException(status_code=404, detail="Réunion introuvable.")
    return utils.meeting_to_out(meeting)


@router.patch("/{meeting_id}", response_model=schemas.MeetingOut)
def update_meeting(meeting_id: int, payload: schemas.MeetingUpdate, db: Session = Depends(get_db),
                    _: models.User = Depends(require_staff)):
    meeting = db.get(models.Meeting, meeting_id)
    if meeting is None:
        raise HTTPException(status_code=404, detail="Réunion introuvable.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(meeting, field, value)
    db.commit()
    db.refresh(meeting)
    return utils.meeting_to_out(meeting)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(meeting_id: int, db: Session = Depends(get_db),
                    _: models.User = Depends(require_staff)):
    meeting = db.get(models.Meeting, meeting_id)
    if meeting is None:
        raise HTTPException(status_code=404, detail="Réunion introuvable.")
    db.delete(meeting)
    db.commit()


@router.patch("/{meeting_id}/rsvp", response_model=schemas.MeetingOut)
def rsvp(meeting_id: int, payload: schemas.ParticipantResponseUpdate, db: Session = Depends(get_db),
          current_user: models.User = Depends(get_current_user)):
    meeting = db.get(models.Meeting, meeting_id)
    if meeting is None:
        raise HTTPException(status_code=404, detail="Réunion introuvable.")
    participant = next((p for p in meeting.participants if p.user_id == current_user.id), None)
    if participant is None:
        participant = models.MeetingParticipant(meeting_id=meeting.id, user_id=current_user.id)
        meeting.participants.append(participant)
    participant.response = payload.response
    db.commit()
    db.refresh(meeting)
    return utils.meeting_to_out(meeting)


@router.patch("/{meeting_id}/minutes", response_model=schemas.MeetingOut)
def update_minutes(meeting_id: int, payload: schemas.MeetingMinutesUpdate, db: Session = Depends(get_db),
                    _: models.User = Depends(require_staff)):
    """Enregistre les grandes lignes / le compte-rendu de la réunion."""
    meeting = db.get(models.Meeting, meeting_id)
    if meeting is None:
        raise HTTPException(status_code=404, detail="Réunion introuvable.")
    meeting.minutes = payload.minutes
    db.commit()
    db.refresh(meeting)
    return utils.meeting_to_out(meeting)
