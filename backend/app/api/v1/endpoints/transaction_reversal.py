from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.transaction_reversal import TransactionReversalRequest
from app.services.transaction_reversal import ReversalError, reverse_transfer

router = APIRouter(
    prefix="/admin/transactions",
    tags=["Admin - Transaction Reversal"],
)


@router.post("/{transaction_id}/reverse", status_code=201)
def reverse_transaction_endpoint(
    transaction_id: int,
    payload: TransactionReversalRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return reverse_transfer(
            db,
            transaction_id=transaction_id,
            admin_user_id=admin.id,
            reason=payload.reason,
        )
    except ReversalError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.detail,
        ) from exc