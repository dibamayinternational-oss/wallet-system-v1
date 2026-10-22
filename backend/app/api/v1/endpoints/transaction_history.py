
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import cast, func, or_, select, String, exists
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin, get_current_user
from app.db.dependencies import get_db
from app.models.ledger_account import LedgerAccount
from app.models.ledger_entry import LedgerEntry
from app.models.ledger_transaction import LedgerTransaction
from app.models.transfer import Transfer
from app.models.user import User
from app.models.wallet import Wallet
from app.services.transaction_history import (
    HistoryError,
    get_transaction_history,
)



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
    search: str | None = Query(None, min_length=1, max_length=100),
    transaction_type: Literal[
        "deposit", "withdrawal", "transfer", "fee", "reversal", "adjustment"
    ] | None = None,
    status: Literal["draft", "posted", "reversed"] | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    user_id: int | None = Query(None, ge=1),
    wallet_id: int | None = Query(None, ge=1),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    # Validate the date range.
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date must not be after end date.",
        )

    # Use posted_at when available; otherwise use created_at.
    effective_date = func.coalesce(
        LedgerTransaction.posted_at,
        LedgerTransaction.created_at,
    )

    query = select(LedgerTransaction)

    # Search transaction reference, description, participant name/email,
    # wallet number, or wallet ID.
    if search:
        search_term = search.strip()

        if not search_term:
            raise HTTPException(
                status_code=400,
                detail="Search cannot contain only whitespace.",
            )

        pattern = f"%{search_term}%"

        matching_participant = exists(
            select(1)
            .select_from(LedgerEntry)
            .join(
                LedgerAccount,
                LedgerEntry.ledger_account_id == LedgerAccount.id,
            )
            .join(
                Wallet,
                LedgerAccount.wallet_id == Wallet.id,
            )
            .join(
                User,
                Wallet.user_id == User.id,
            )
            .where(
                LedgerEntry.transaction_id == LedgerTransaction.id,
                or_(
                    User.full_name.ilike(pattern),
                    User.email.ilike(pattern),
                    Wallet.wallet_number.ilike(pattern),
                    cast(Wallet.id, String).ilike(pattern),
                ),
            )
        )

        query = query.where(
            or_(
                LedgerTransaction.reference.ilike(pattern),
                LedgerTransaction.description.ilike(pattern),
                matching_participant,
            )
        )

    # Filter by transaction type.
    if transaction_type:
        query = query.where(
            LedgerTransaction.transaction_type == transaction_type
        )

    # Filter by transaction status.
    if status:
        query = query.where(LedgerTransaction.status == status)

    # Filter by effective transaction date.
    if start_date:
        query = query.where(effective_date >= start_date)

    if end_date:
        query = query.where(effective_date <= end_date)

    # Filter by a particular user who participated in the transaction.
    if user_id is not None:
        matching_user = exists(
            select(1)
            .select_from(LedgerEntry)
            .join(
                LedgerAccount,
                LedgerEntry.ledger_account_id == LedgerAccount.id,
            )
            .join(
                Wallet,
                LedgerAccount.wallet_id == Wallet.id,
            )
            .where(
                LedgerEntry.transaction_id == LedgerTransaction.id,
                Wallet.user_id == user_id,
            )
        )
        query = query.where(matching_user)

   

    # Filter by a particular wallet that participated in the transaction.
    if wallet_id is not None:
        matching_wallet = exists(
            select(1)
            .select_from(LedgerEntry)
            .join(
                LedgerAccount,
                LedgerEntry.ledger_account_id == LedgerAccount.id,
            )
            .where(
                LedgerEntry.transaction_id == LedgerTransaction.id,
                LedgerAccount.wallet_id == wallet_id,
            )
        )
        query = query.where(matching_wallet)

    # Count matching transactions before pagination.
    total = db.scalar(
        select(func.count()).select_from(query.subquery())
    ) or 0

    # Fetch only the requested page, newest first.
    transactions = db.scalars(
        query.order_by(
            effective_date.desc(),
            LedgerTransaction.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    transaction_ids = [tx.id for tx in transactions]

    # Collect the users and wallets involved in this page's transactions.
    participants_by_transaction: dict[int, dict[int, dict]] = {
        transaction_id: {}
        for transaction_id in transaction_ids
    }

    if transaction_ids:
        participant_rows = db.execute(
            select(
                LedgerEntry.transaction_id,
                Wallet.id,
                Wallet.wallet_number,
                User.id,
                User.full_name,
                User.email,
            )
            .join(
                LedgerAccount,
                LedgerEntry.ledger_account_id == LedgerAccount.id,
            )
            .join(
                Wallet,
                LedgerAccount.wallet_id == Wallet.id,
            )
            .join(
                User,
                Wallet.user_id == User.id,
            )
            .where(
                LedgerEntry.transaction_id.in_(transaction_ids)
            )
        ).all()

        for (
            transaction_id,
            participant_wallet_id,
            participant_wallet_number,
            participant_user_id,
            participant_name,
            participant_email,
        ) in participant_rows:
            participants_by_transaction[transaction_id][
                participant_wallet_id
            ] = {
                "user_id": participant_user_id,
                "full_name": participant_name,
                "email": participant_email,
                "wallet_id": participant_wallet_id,
                "wallet_number": participant_wallet_number,
            }

    # Load transfer records for the current page.
    transfers_by_transaction = {}

    if transaction_ids:
        transfers = db.scalars(
            select(Transfer).where(
                Transfer.ledger_transaction_id.in_(transaction_ids)
            )
        ).all()

        transfers_by_transaction = {
            transfer.ledger_transaction_id: transfer
            for transfer in transfers
        }

    # Prepare explicit sender/receiver information for transfers.
    transfer_wallet_ids = set()

    for transfer in transfers_by_transaction.values():
        transfer_wallet_ids.add(transfer.sender_wallet_id)
        transfer_wallet_ids.add(transfer.receiver_wallet_id)

    wallets_by_id = {}
    users_by_id = {}

    if transfer_wallet_ids:
        transfer_wallets = db.scalars(
            select(Wallet).where(Wallet.id.in_(transfer_wallet_ids))
        ).all()

        wallets_by_id = {
            wallet.id: wallet for wallet in transfer_wallets
        }

        transfer_user_ids = {
            wallet.user_id for wallet in transfer_wallets
        }

        transfer_users = db.scalars(
            select(User).where(User.id.in_(transfer_user_ids))
        ).all()

        users_by_id = {
            user.id: user for user in transfer_users
        }

    items = []

    for tx in transactions:
        transfer = transfers_by_transaction.get(tx.id)

        sender = None
        receiver = None

        if transfer:
            sender_wallet = wallets_by_id.get(
                transfer.sender_wallet_id
            )
            receiver_wallet = wallets_by_id.get(
                transfer.receiver_wallet_id
            )

            sender_user = (
                users_by_id.get(sender_wallet.user_id)
                if sender_wallet else None
            )
            receiver_user = (
                users_by_id.get(receiver_wallet.user_id)
                if receiver_wallet else None
            )

            if sender_wallet:
                sender = {
                    "user_id": sender_user.id if sender_user else None,
                    "full_name": (
                        sender_user.full_name if sender_user else None
                    ),
                    "email": sender_user.email if sender_user else None,
                    "wallet_id": sender_wallet.id,
                    "wallet_number": sender_wallet.wallet_number,
                }

            if receiver_wallet:
                receiver = {
                    "user_id": (
                        receiver_user.id if receiver_user else None
                    ),
                    "full_name": (
                        receiver_user.full_name if receiver_user else None
                    ),
                    "email": (
                        receiver_user.email if receiver_user else None
                    ),
                    "wallet_id": receiver_wallet.id,
                    "wallet_number": receiver_wallet.wallet_number,
                }

        items.append(
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
                "participants": list(
                    participants_by_transaction[tx.id].values()
                ),
                "sender": sender,
                "receiver": receiver,
                "transfer_amount": (
                    transfer.amount if transfer else None
                ),
                "transfer_fee": (
                    transfer.fee if transfer else None
                ),
            }
        )

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
    }
