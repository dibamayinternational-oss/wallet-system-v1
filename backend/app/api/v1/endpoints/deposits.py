
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.transaction import DepositRequest
from app.services.deposit import deposit_money

router = APIRouter(prefix="/deposits", tags=["Deposits"])


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_deposit(
    payload: DepositRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return deposit_money(
            db,
            user_id=current_user.id,
            amount=Decimal(payload.amount),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
