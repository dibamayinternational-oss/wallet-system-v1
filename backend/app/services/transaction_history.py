from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ledger_account import LedgerAccount
from app.models.ledger_entry import LedgerEntry
from app.models.ledger_transaction import LedgerTransaction
from app.models.transfer import Transfer
from app.models.user import User
from app.models.wallet import Wallet
from app.services.date_filters import (
    normalize_datetime_filter,
    normalize_stored_datetime,
)

class HistoryError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def get_transaction_history(
    db: Session,
    *,
    user_id: int,
    page: int = 1,
    page_size: int = 20,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    transaction_type: str | None = None,
) -> dict:
    if page < 1:
        raise HistoryError("Page must be at least 1.")

    if not 1 <= page_size <= 100:
        raise HistoryError("Page size must be between 1 and 100.")

    # if start_date and end_date and start_date > end_date:
    #     raise HistoryError("Start date must not be after end date.")
    start_date = normalize_datetime_filter(start_date)
    end_date = normalize_datetime_filter(
        end_date,
        end_of_day=True,
    )

    if start_date is not None and end_date is not None:
        if start_date > end_date:
            raise HistoryError(
                "Start date must not be after end date."
            )

    wallet = db.scalar(
        select(Wallet).where(Wallet.user_id == user_id)
    )
    if wallet is None:
        raise HistoryError("Wallet not found.", 404)

    account = db.scalar(
        select(LedgerAccount).where(
            LedgerAccount.wallet_id == wallet.id
        )
    )
    if account is None:
        raise HistoryError("Wallet ledger account not found.", 409)

    # Include posted and reversed original transactions. Reversal entries
    # are separate transactions and must also appear in the statement.
    rows = db.execute(
        select(LedgerEntry, LedgerTransaction)
        .join(
            LedgerTransaction,
            LedgerTransaction.id == LedgerEntry.transaction_id,
        )
        .where(
            LedgerEntry.ledger_account_id == account.id,
            LedgerTransaction.status.in_(["posted", "reversed"]),
        )
        .order_by(
            LedgerTransaction.posted_at.asc(),
            LedgerTransaction.id.asc(),
            LedgerEntry.id.asc(),
        )
    ).all()
    reversed_original_ids = set(
        db.scalars(
            select(LedgerTransaction.reversal_of_transaction_id).where(
                LedgerTransaction.reversal_of_transaction_id.is_not(None)
            )
        ).all()
    )

    # Compute the running balance across all account activity before
    # applying the display filters. Credits increase wallet liabilities;
    # debits decrease them.
    running_balance = Decimal("0.00")
    all_items = []

    for entry, transaction in rows:
        if entry.side == "credit":
            running_balance += entry.amount
        else:
            running_balance -= entry.amount

        transfer = db.scalar(
            select(Transfer).where(
                Transfer.ledger_transaction_id == transaction.id
            )
        )

        sender_name = receiver_name = None
        sender_wallet_number = receiver_wallet_number = None
        amount = entry.amount

        if transfer is not None:
            sender_wallet = db.get(Wallet, transfer.sender_wallet_id)
            receiver_wallet = db.get(Wallet, transfer.receiver_wallet_id)

            sender_user = (
                db.get(User, sender_wallet.user_id)
                if sender_wallet else None
            )
            receiver_user = (
                db.get(User, receiver_wallet.user_id)
                if receiver_wallet else None
            )

            sender_name = sender_user.full_name if sender_user else None
            receiver_name = receiver_user.full_name if receiver_user else None
            sender_wallet_number = (
                sender_wallet.wallet_number if sender_wallet else None
            )
            receiver_wallet_number = (
                receiver_wallet.wallet_number if receiver_wallet else None
            )
            amount = transfer.amount

        # effective_date = transaction.posted_at or transaction.created_at
        effective_date = normalize_stored_datetime(
            transaction.posted_at or transaction.created_at
        )

        item = {
            "transaction_id": transaction.id,
            "reference": transaction.reference,
            "transaction_type": transaction.transaction_type,
            "status": transaction.status,
            "is_reversed": transaction.id in reversed_original_ids,
            "created_at": effective_date,
            "amount": amount,
            "debit": (
                entry.amount if entry.side == "debit" else Decimal("0.00")
            ),
            "credit": (
                entry.amount if entry.side == "credit" else Decimal("0.00")
            ),
            "running_balance": running_balance,
            "description": transaction.description,
            "sender_name": sender_name,
            "receiver_name": receiver_name,
            "sender_wallet_number": sender_wallet_number,
            "receiver_wallet_number": receiver_wallet_number,
            
            "reversal_of_transaction_id": (
                transaction.reversal_of_transaction_id
            ),
            "reversal_reason": transaction.reversal_reason,
        }
        all_items.append(item)

    filtered = [
        item for item in all_items
        if (start_date is None or item["created_at"] >= start_date)
        and (end_date is None or item["created_at"] <= end_date)
        and (
            transaction_type is None
            or item["transaction_type"] == transaction_type
        )
    ]

    # Newest first for the API response.
    filtered.reverse()
    total = len(filtered)
    offset = (page - 1) * page_size

    return {
        "items": filtered[offset:offset + page_size],
        "page": page,
        "page_size": page_size,
        "total": total,
    }