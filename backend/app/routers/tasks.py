from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, utils
from ..database import get_db
from ..deps import get_current_user, require_staff

router = APIRouter(prefix="/api/tasks", tags=["Tâches"])

_WEIGHT = {models.StatusEnum.non_entame: 0, models.StatusEnum.en_cours: 50, models.StatusEnum.valide: 100}


def _recompute_from_steps(task: models.Task) -> None:
    """Si la tâche a un calendrier d'étapes, le pourcentage et le statut global en sont déduits."""
    if not task.steps:
        return
    total = sum(_WEIGHT[s.status] for s in task.steps)
    task.progress_percent = round(total / (len(task.steps) * 100) * 100)
    if all(s.status == models.StatusEnum.valide for s in task.steps):
        task.status = models.StatusEnum.valide
    elif all(s.status == models.StatusEnum.non_entame for s in task.steps):
        task.status = models.StatusEnum.non_entame
    else:
        task.status = models.StatusEnum.en_cours


def _can_view(task: models.Task, user: models.User) -> bool:
    if user.role in (models.RoleEnum.admin, models.RoleEnum.fondateur):
        return True
    return task.assigned_to_id == user.id or task.created_by_id == user.id


@router.get("", response_model=list[schemas.TaskOut])
def list_tasks(
    mine: bool = False,
    status_filter: Optional[models.StatusEnum] = None,
    assigned_to_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Task)
    is_staff = current_user.role in (models.RoleEnum.admin, models.RoleEnum.fondateur)
    if mine or not is_staff:
        query = query.filter(
            (models.Task.assigned_to_id == current_user.id) | (models.Task.created_by_id == current_user.id)
        )
    if assigned_to_id is not None and is_staff:
        query = query.filter(models.Task.assigned_to_id == assigned_to_id)
    if status_filter is not None:
        query = query.filter(models.Task.status == status_filter)
    tasks = query.order_by(models.Task.created_at.desc()).all()
    return [utils.task_to_out(t) for t in tasks]


@router.post("", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff),
):
    task = models.Task(
        title=payload.title, description=payload.description, category=payload.category,
        assigned_to_id=payload.assigned_to_id, start_date=payload.start_date, end_date=payload.end_date,
        created_by_id=current_user.id,
    )
    for idx, step in enumerate(payload.steps):
        task.steps.append(models.TaskStep(
            title=step.title, step_date=step.step_date, status=step.status,
            order_index=step.order_index or idx,
        ))
    _recompute_from_steps(task)
    db.add(task)
    db.commit()
    db.refresh(task)
    return utils.task_to_out(task)


@router.get("/{task_id}", response_model=schemas.TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db),
             current_user: models.User = Depends(get_current_user)):
    task = db.get(models.Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Tâche introuvable.")
    if not _can_view(task, current_user):
        raise HTTPException(status_code=403, detail="Vous n'avez pas accès à cette tâche.")
    return utils.task_to_out(task)


@router.patch("/{task_id}", response_model=schemas.TaskOut)
def update_task(
    task_id: int,
    payload: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.get(models.Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Tâche introuvable.")
    is_staff = current_user.role in (models.RoleEnum.admin, models.RoleEnum.fondateur)
    is_assignee = task.assigned_to_id == current_user.id
    if not (is_staff or is_assignee):
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas modifier cette tâche.")

    data = payload.model_dump(exclude_unset=True)
    if not is_staff:
        # La personne assignée ne peut ajuster que l'avancement, pas réaffecter/renommer la tâche.
        data = {k: v for k, v in data.items() if k in ("status", "progress_percent")}
    for field, value in data.items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return utils.task_to_out(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db),
                 _: models.User = Depends(require_staff)):
    task = db.get(models.Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Tâche introuvable.")
    db.delete(task)
    db.commit()


@router.post("/{task_id}/steps", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
def add_step(task_id: int, payload: schemas.TaskStepIn, db: Session = Depends(get_db),
             _: models.User = Depends(require_staff)):
    task = db.get(models.Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Tâche introuvable.")
    task.steps.append(models.TaskStep(
        title=payload.title, step_date=payload.step_date, status=payload.status,
        order_index=payload.order_index if payload.order_index else len(task.steps),
    ))
    _recompute_from_steps(task)
    db.commit()
    db.refresh(task)
    return utils.task_to_out(task)


@router.patch("/{task_id}/steps/{step_id}", response_model=schemas.TaskOut)
def update_step(
    task_id: int, step_id: int, payload: schemas.TaskStepUpdate,
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user),
):
    task = db.get(models.Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Tâche introuvable.")
    step = next((s for s in task.steps if s.id == step_id), None)
    if step is None:
        raise HTTPException(status_code=404, detail="Étape introuvable.")
    is_staff = current_user.role in (models.RoleEnum.admin, models.RoleEnum.fondateur)
    is_assignee = task.assigned_to_id == current_user.id
    if not (is_staff or is_assignee):
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas modifier cette étape.")
    data = payload.model_dump(exclude_unset=True)
    if not is_staff:
        data = {k: v for k, v in data.items() if k == "status"}
    for field, value in data.items():
        setattr(step, field, value)
    _recompute_from_steps(task)
    db.commit()
    db.refresh(task)
    return utils.task_to_out(task)


@router.delete("/{task_id}/steps/{step_id}", response_model=schemas.TaskOut)
def delete_step(task_id: int, step_id: int, db: Session = Depends(get_db),
                 _: models.User = Depends(require_staff)):
    task = db.get(models.Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Tâche introuvable.")
    step = next((s for s in task.steps if s.id == step_id), None)
    if step is None:
        raise HTTPException(status_code=404, detail="Étape introuvable.")
    task.steps.remove(step)
    db.delete(step)
    _recompute_from_steps(task)
    db.commit()
    db.refresh(task)
    return utils.task_to_out(task)
