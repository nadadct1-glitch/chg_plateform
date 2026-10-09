from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas, utils
from ..database import get_db
from ..deps import get_current_user, require_admin

router = APIRouter(prefix="/api/process", tags=["Processus de création"])


def _full_tree_query(db: Session):
    return (
        db.query(models.ProcessSection)
        .options(
            joinedload(models.ProcessSection.phases)
            .joinedload(models.ProcessPhase.tasks)
            .joinedload(models.ProcessTask.items)
            .joinedload(models.ProcessItem.assignee)
        )
        .order_by(models.ProcessSection.order_index)
    )


@router.get("", response_model=list[schemas.ProcessSectionOut])
def get_process_tree(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    sections = _full_tree_query(db).all()
    return [utils.process_section_to_out(s) for s in sections]


@router.patch("/items/{item_id}", response_model=schemas.ProcessItemOut)
def update_process_item(
    item_id: int, payload: schemas.ProcessItemUpdate,
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user),
):
    item = db.get(models.ProcessItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Action introuvable.")
    is_staff = current_user.role in (models.RoleEnum.admin, models.RoleEnum.fondateur)
    is_assignee = item.assigned_to_id == current_user.id
    if not (is_staff or is_assignee):
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas modifier cette action.")
    data = payload.model_dump(exclude_unset=True)
    if not is_staff:
        data = {k: v for k, v in data.items() if k == "status"}
    for field, value in data.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return utils.process_item_to_out(item)


# ---------------------------------------------------------------------------
# Gestion structurelle du processus (réservée à l'administration) :
# ajout et suppression des grandes étapes (phases), des tâches et des
# actions détaillées.
# ---------------------------------------------------------------------------

@router.post("/sections/{section_id}/phases", response_model=schemas.ProcessPhaseOut,
             status_code=status.HTTP_201_CREATED)
def create_phase(section_id: int, payload: schemas.ProcessPhaseCreate, db: Session = Depends(get_db),
                  _: models.User = Depends(require_admin)):
    section = db.get(models.ProcessSection, section_id)
    if section is None:
        raise HTTPException(status_code=404, detail="Section introuvable.")
    next_number = payload.number or (max([p.number for p in section.phases], default=0) + 1)
    phase = models.ProcessPhase(
        section_id=section.id, number=next_number, title=payload.title, order_index=len(section.phases),
    )
    db.add(phase)
    db.commit()
    db.refresh(phase)
    return utils.process_phase_to_out(phase)


@router.delete("/phases/{phase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_phase(phase_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    phase = db.get(models.ProcessPhase, phase_id)
    if phase is None:
        raise HTTPException(status_code=404, detail="Étape introuvable.")
    db.delete(phase)
    db.commit()


@router.post("/phases/{phase_id}/tasks", response_model=schemas.ProcessTaskOut,
             status_code=status.HTTP_201_CREATED)
def create_task(phase_id: int, payload: schemas.ProcessTaskCreate, db: Session = Depends(get_db),
                 _: models.User = Depends(require_admin)):
    phase = db.get(models.ProcessPhase, phase_id)
    if phase is None:
        raise HTTPException(status_code=404, detail="Étape introuvable.")
    task = models.ProcessTask(
        phase_id=phase.id, kind=payload.kind or "Tâche", code=payload.code, title=payload.title,
        order_index=len(phase.tasks),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return utils.process_task_to_out(task)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    task = db.get(models.ProcessTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Tâche introuvable.")
    db.delete(task)
    db.commit()


@router.post("/tasks/{task_id}/items", response_model=schemas.ProcessItemOut,
             status_code=status.HTTP_201_CREATED)
def create_item(task_id: int, payload: schemas.ProcessItemCreate, db: Session = Depends(get_db),
                 _: models.User = Depends(require_admin)):
    task = db.get(models.ProcessTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Tâche introuvable.")
    next_number = max([i.number for i in task.items], default=0) + 1
    item = models.ProcessItem(
        task_id=task.id, number=next_number, description=payload.description,
        target_date=payload.target_date, assigned_to_id=payload.assigned_to_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return utils.process_item_to_out(item)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    item = db.get(models.ProcessItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Action introuvable.")
    db.delete(item)
    db.commit()
