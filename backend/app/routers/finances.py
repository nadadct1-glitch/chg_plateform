from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, utils
from ..database import get_db
from ..deps import require_admin

router = APIRouter(prefix="/api/finances", tags=["Finances"])


@router.get("/expenses", response_model=list[schemas.ExpenseOut])
def list_expenses(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    rows = db.query(models.Expense).order_by(models.Expense.expense_date.desc(), models.Expense.id.desc()).all()
    return [utils.expense_to_out(e) for e in rows]


@router.post("/expenses", response_model=schemas.ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(payload: schemas.ExpenseCreate, db: Session = Depends(get_db),
                    current_user: models.User = Depends(require_admin)):
    e = models.Expense(**payload.model_dump(), recorded_by_id=current_user.id)
    db.add(e)
    db.commit()
    db.refresh(e)
    return utils.expense_to_out(e)


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    e = db.get(models.Expense, expense_id)
    if e is None:
        raise HTTPException(status_code=404, detail="Dépense introuvable.")
    db.delete(e)
    db.commit()


@router.get("/incomes", response_model=list[schemas.IncomeOut])
def list_incomes(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    rows = db.query(models.Income).order_by(models.Income.income_date.desc(), models.Income.id.desc()).all()
    return [utils.income_to_out(i) for i in rows]


@router.post("/incomes", response_model=schemas.IncomeOut, status_code=status.HTTP_201_CREATED)
def create_income(payload: schemas.IncomeCreate, db: Session = Depends(get_db),
                   current_user: models.User = Depends(require_admin)):
    i = models.Income(**payload.model_dump(), recorded_by_id=current_user.id)
    db.add(i)
    db.commit()
    db.refresh(i)
    return utils.income_to_out(i)


@router.delete("/incomes/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_income(income_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    i = db.get(models.Income, income_id)
    if i is None:
        raise HTTPException(status_code=404, detail="Entrée introuvable.")
    db.delete(i)
    db.commit()


@router.get("/summary", response_model=schemas.FinanceSummary)
def finance_summary(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    expenses = db.query(models.Expense).all()
    incomes = db.query(models.Income).all()
    total_expenses = sum(e.amount for e in expenses)
    total_income = sum(i.amount for i in incomes)

    by_cat: dict[str, int] = {}
    for e in expenses:
        key = e.category or "Autre"
        by_cat[key] = by_cat.get(key, 0) + e.amount

    by_source: dict[str, int] = {}
    for i in incomes:
        key = i.source or "Autre"
        by_source[key] = by_source.get(key, 0) + i.amount

    return schemas.FinanceSummary(
        total_income=total_income, total_expenses=total_expenses,
        balance=total_income - total_expenses,
        expenses_by_category=by_cat, income_by_source=by_source,
    )
