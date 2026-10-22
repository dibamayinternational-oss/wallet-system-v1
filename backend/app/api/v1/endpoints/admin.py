
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import cast, func, or_, select, String
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin
from app.db.dependencies import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.wallet import Wallet
from app.services.audit_log import record_admin_action


router = APIRouter(
    prefix="/admin",
    tags=["Admin Controls"],
)


@router.get("/users")
def list_users_and_balances(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, min_length=1, max_length=100),
    role: Literal["user", "admin"] | None = None,
    is_active: bool | None = None,
    wallet_status: Literal["active", "frozen"] | None = None,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = (
        select(User, Wallet)
        .outerjoin(Wallet, Wallet.user_id == User.id)
    )

    if search:
        term = search.strip()

        if not term:
            raise HTTPException(
                status_code=400,
                detail="Search cannot contain only whitespace.",
            )

        pattern = f"%{term}%"

        query = query.where(
            or_(
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
                cast(User.id, String).ilike(pattern),
                Wallet.wallet_number.ilike(pattern),
                cast(Wallet.id, String).ilike(pattern),
            )
        )

    if role is not None:
        query = query.where(User.role == role)

    if is_active is not None:
        query = query.where(User.is_active == is_active)

    if wallet_status is not None:
        query = query.where(Wallet.status == wallet_status)

    total = db.scalar(
        select(func.count()).select_from(query.subquery())
    ) or 0

    rows = db.execute(
        query.order_by(
            User.created_at.desc(),
            User.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = []

    for user, wallet in rows:
        items.append(
            {
                "user_id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
                "user_created_at": user.created_at,
                "wallet": (
                    {
                        "wallet_id": wallet.id,
                        "wallet_number": wallet.wallet_number,
                        "balance": wallet.balance,
                        "reserved_balance": wallet.reserved_balance,
                        "available_balance": wallet.available_balance,
                        "status": wallet.status,
                        "created_at": wallet.created_at,
                    }
                    if wallet else None
                ),
            }
        )

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
    }


def _change_wallet_status(
    *,
    wallet_id: int,
    new_status: Literal["active", "frozen"],
    admin: User,
    db: Session,
) -> dict:
    wallet = db.scalar(
        select(Wallet)
        .where(Wallet.id == wallet_id)
        .with_for_update()
    )

    if wallet is None:
        raise HTTPException(
            status_code=404,
            detail="Wallet not found.",
        )

    if wallet.status == new_status:
        raise HTTPException(
            status_code=409,
            detail=f"Wallet is already {new_status}.",
        )

    old_status = wallet.status
    wallet.status = new_status

    try:
        record_admin_action(
            db,
            actor_user_id=admin.id,
            target_user_id=wallet.user_id,
            wallet_id=wallet.id,
            action=(
                "wallet_frozen"
                if new_status == "frozen"
                else "wallet_unfrozen"
            ),
            details={
                "previous_status": old_status,
                "new_status": new_status,
            },
            commit=False,
        )

        # Wallet status and audit entry are committed together.
        db.commit()
        db.refresh(wallet)

    except Exception:
        db.rollback()
        raise

    return {
        "message": f"Wallet {new_status} successfully.",
        "wallet_id": wallet.id,
        "wallet_number": wallet.wallet_number,
        "user_id": wallet.user_id,
        "previous_status": old_status,
        "status": wallet.status,
    }


@router.post("/wallets/{wallet_id}/freeze")
def freeze_wallet(
    wallet_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return _change_wallet_status(
        wallet_id=wallet_id,
        new_status="frozen",
        admin=admin,
        db=db,
    )


@router.post("/wallets/{wallet_id}/unfreeze")
def unfreeze_wallet(
    wallet_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return _change_wallet_status(
        wallet_id=wallet_id,
        new_status="active",
        admin=admin,
        db=db,
    )


@router.get("/audit-logs")
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: str | None = Query(None, min_length=1, max_length=60),
    actor_user_id: int | None = Query(None, ge=1),
    target_user_id: int | None = Query(None, ge=1),
    wallet_id: int | None = Query(None, ge=1),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date must not be after end date.",
        )

    query = select(AuditLog)

    if action:
        query = query.where(AuditLog.action == action.strip())

    if actor_user_id is not None:
        query = query.where(
            AuditLog.actor_user_id == actor_user_id
        )

    if target_user_id is not None:
        query = query.where(
            AuditLog.target_user_id == target_user_id
        )

    if wallet_id is not None:
        query = query.where(AuditLog.wallet_id == wallet_id)

    if start_date is not None:
        query = query.where(AuditLog.created_at >= start_date)

    if end_date is not None:
        query = query.where(AuditLog.created_at <= end_date)

    total = db.scalar(
        select(func.count()).select_from(query.subquery())
    ) or 0

    logs = db.scalars(
        query.order_by(
            AuditLog.created_at.desc(),
            AuditLog.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return {
        "items": [
            {
                "id": log.id,
                "actor_user_id": log.actor_user_id,
                "target_user_id": log.target_user_id,
                "wallet_id": log.wallet_id,
                "action": log.action,
                "details": log.details,
                "created_at": log.created_at,
            }
            for log in logs
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
    }
