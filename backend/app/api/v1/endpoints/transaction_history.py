from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_current_admin
from app.db.dependencies import get_db
from app.models.user import User
from app.services.transaction_history import (
    HistoryError,
    get_transaction_history,
)
from sqlalchemy import select, func

from app.models.ledger_transaction import LedgerTransaction


router = APIRouter(
    prefix="/transactions",
    tags=["Transaction History"],
)


@router.get("/history")
def transaction_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    transaction_type: Literal[
        "deposit", "withdrawal", "transfer", "fee", "reversal", "adjustment"
    ] | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return get_transaction_history(
            db,
            user_id=current_user.id,
            page=page,
            page_size=page_size,
            start_date=start_date,
            end_date=end_date,
            transaction_type=transaction_type,
        )
    except HistoryError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.detail,
        ) from exc



@router.get("/admin/all")
def all_transaction_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = select(LedgerTransaction)

    total = db.scalar(
        select(func.count()).select_from(LedgerTransaction)
    ) or 0

    transactions = db.scalars(
        query.order_by(
            LedgerTransaction.created_at.desc(),
            LedgerTransaction.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return {
        "items": [
            {
                "transaction_id": tx.id,
                "reference": tx.reference,
                "transaction_type": tx.transaction_type,
                "status": tx.status,
                "created_at": tx.created_at,
                "posted_at": tx.posted_at,
                "description": tx.description,
                "reversal_of_transaction_id": (
                    tx.reversal_of_transaction_id
                ),
                "reversed_by_user_id": tx.reversed_by_user_id,
                "reversal_reason": tx.reversal_reason,
            }
            for tx in transactions
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
    }