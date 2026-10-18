
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.transfer import TransferCreate
from app.services.transfer import (
    TransferError,
    preview_recipient,
    transfer_money,
)

router = APIRouter(prefix="/transfers", tags=["Transfers"])


@router.get("/recipient/{wallet_number}")
def get_recipient_preview(
    wallet_number: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return preview_recipient(
            db,
            sender_user_id=current_user.id,
            receiver_wallet_number=wallet_number,
        )
    except TransferError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.detail,
        ) from exc


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_transfer(
    payload: TransferCreate,
    idempotency_key: str = Header(
        ...,
        alias="Idempotency-Key",
        min_length=8,
        max_length=100,
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return transfer_money(
            db,
            sender_user_id=current_user.id,
            receiver_wallet_number=payload.receiver_wallet_number,
            amount=payload.amount,
            note=payload.note,
            idempotency_key=idempotency_key,
        )
    except TransferError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.detail,
        ) from exc
