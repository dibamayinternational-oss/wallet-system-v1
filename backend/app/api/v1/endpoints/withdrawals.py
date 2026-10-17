from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin, get_current_user
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.withdrawal import (
    WithdrawalCreate,
    WithdrawalRejectRequest,
    WithdrawalResponse,
)
from app.services.withdrawal import (
    WithdrawalError,
    approve_withdrawal,
    list_my_withdrawals,
    list_pending_withdrawals,
    reject_withdrawal,
    request_withdrawal,
)


router = APIRouter(
    prefix="/withdrawals",
    tags=["Withdrawals"],
)


@router.post(
    "/",
    response_model=WithdrawalResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_withdrawal(
    payload: WithdrawalCreate,
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
        return request_withdrawal(
            db,
            user_id=current_user.id,
            amount=payload.amount,
            idempotency_key=idempotency_key,
        )
    except WithdrawalError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.detail,
        ) from exc


@router.get(
    "/me",
    response_model=list[WithdrawalResponse],
)
def get_my_withdrawals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return list_my_withdrawals(
            db,
            user_id=current_user.id,
        )
    except WithdrawalError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.detail,
        ) from exc


@router.get(
    "/admin/pending",
    response_model=list[WithdrawalResponse],
)
def get_pending_withdrawals(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return list_pending_withdrawals(db)


@router.post(
    "/admin/{withdrawal_id}/approve",
    response_model=WithdrawalResponse,
)
def approve_withdrawal_endpoint(
    withdrawal_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return approve_withdrawal(
            db,
            withdrawal_id=withdrawal_id,
            admin=admin,
        )
    except WithdrawalError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.detail,
        ) from exc


@router.post(
    "/admin/{withdrawal_id}/reject",
    response_model=WithdrawalResponse,
)
def reject_withdrawal_endpoint(
    withdrawal_id: int,
    payload: WithdrawalRejectRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return reject_withdrawal(
            db,
            withdrawal_id=withdrawal_id,
            admin=admin,
            reason=payload.reason,
        )
    except WithdrawalError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.detail,
        ) from exc