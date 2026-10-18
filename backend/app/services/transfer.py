
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import (
    TRANSFER_DAILY_LIMIT,
    TRANSFER_FEE_RATE,
)
from app.models.user import User
from app.models.wallet import Wallet
from app.models.ledger_account import LedgerAccount
from app.models.ledger_transaction import LedgerTransaction
from app.models.transfer import Transfer
from app.services.ledger import post_transaction


CENT = Decimal("0.01")


class TransferError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def _get_wallet(db: Session, user_id: int) -> Wallet:
    wallet = db.scalar(
        select(Wallet).where(Wallet.user_id == user_id)
    )
    if wallet is None:
        raise TransferError("Sender wallet not found.", 404)
    return wallet


def _transfer_response(
    db: Session,
    transfer: Transfer,
    sender: Wallet,
    receiver: Wallet,
) -> dict:
    transaction = db.get(
        LedgerTransaction,
        transfer.ledger_transaction_id,
    )

    if transaction is None:
        raise TransferError(
            "Transfer ledger transaction was not found.", 500
        )

    return {
        "reference": transfer.reference,
        "sender_wallet_number": sender.wallet_number,
        "receiver_wallet_number": receiver.wallet_number,
        "amount": transfer.amount,
        "fee": transfer.fee,
        "total_debit": transfer.amount + transfer.fee,
        "note": transfer.note,
        "status": transfer.status,
        "ledger_transaction_reference": transaction.reference,
        "sender_balance": sender.balance,
        "receiver_balance": receiver.balance,
        "created_at": transfer.created_at,
    }


def preview_recipient(
    db: Session,
    *,
    sender_user_id: int,
    receiver_wallet_number: str,
) -> dict:
    sender = _get_wallet(db, sender_user_id)

    receiver = db.scalar(
        select(Wallet).where(
            Wallet.wallet_number == receiver_wallet_number
        )
    )

    if receiver is None:
        raise TransferError("Receiver wallet not found.", 404)

    if sender.id == receiver.id:
        raise TransferError(
            "You cannot transfer money to your own wallet."
        )

    recipient = db.get(User, receiver.user_id)
    if recipient is None:
        raise TransferError("Receiver user not found.", 404)

    return {
        "receiver_wallet_number": receiver.wallet_number,
        "receiver_name": recipient.full_name,
        "wallet_status": receiver.status,
        "can_receive": (
            receiver.status == "active"
            and recipient.is_active
        ),
    }


def transfer_money(
    db: Session,
    *,
    sender_user_id: int,
    receiver_wallet_number: str,
    amount: Decimal,
    note: str | None,
    idempotency_key: str,
) -> dict:
    if not amount.is_finite() or amount <= 0:
        raise TransferError("Amount must be a positive number.")

    if amount != amount.quantize(CENT):
        raise TransferError(
            "Amount cannot have more than two decimal places."
        )

    if not idempotency_key or not 8 <= len(idempotency_key) <= 100:
        raise TransferError(
            "Idempotency key must contain 8 to 100 characters."
        )

    if note is not None:
        note = note.strip() or None
        if note is not None and len(note) > 500:
            raise TransferError("Note cannot exceed 500 characters.")

    if TRANSFER_FEE_RATE < 0 or TRANSFER_FEE_RATE > 1:
        raise TransferError(
            "Transfer fee configuration must be between 0 and 1.",
            500,
        )

    if TRANSFER_DAILY_LIMIT <= 0:
        raise TransferError(
            "Daily transfer limit configuration must be positive.",
            500,
        )

    sender_initial = _get_wallet(db, sender_user_id)

    receiver_initial = db.scalar(
        select(Wallet).where(
            Wallet.wallet_number == receiver_wallet_number
        )
    )

    if receiver_initial is None:
        raise TransferError("Receiver wallet not found.", 404)

    if sender_initial.id == receiver_initial.id:
        raise TransferError(
            "You cannot transfer money to your own wallet."
        )

    # Lock both wallet rows in a consistent ID order.
    # PostgreSQL honors FOR UPDATE; SQLite does not provide equivalent
    # row-level locking for concurrency testing.
    wallet_ids = sorted([sender_initial.id, receiver_initial.id])

    locked_wallets = db.scalars(
        select(Wallet)
        .where(Wallet.id.in_(wallet_ids))
        .order_by(Wallet.id)
        .with_for_update()
    ).all()

    wallets_by_id = {wallet.id: wallet for wallet in locked_wallets}
    sender = wallets_by_id.get(sender_initial.id)
    receiver = wallets_by_id.get(receiver_initial.id)

    if sender is None or receiver is None:
        raise TransferError("Sender or receiver wallet not found.", 404)

    try:
        # Idempotency replay: do not debit the wallet again.
        existing = db.scalar(
            select(Transfer).where(
                Transfer.idempotency_key == idempotency_key
            )
        )

        if existing is not None:
            if (
                existing.sender_wallet_id != sender.id
                or existing.receiver_wallet_id != receiver.id
                or existing.amount != amount
            ):
                raise TransferError(
                    "Idempotency key was already used for a different transfer.",
                    409,
                )

            return _transfer_response(
                db, existing, sender, receiver
            )

        if sender.status != "active":
            raise TransferError("Sender wallet is frozen.")

        if receiver.status != "active":
            raise TransferError("Receiver wallet is frozen.")

        sender_user = db.get(User, sender.user_id)
        receiver_user = db.get(User, receiver.user_id)

        if sender_user is None or not sender_user.is_active:
            raise TransferError("Sender account is inactive.")

        if receiver_user is None or not receiver_user.is_active:
            raise TransferError("Receiver account is inactive.")

        fee = (amount * TRANSFER_FEE_RATE).quantize(
            CENT,
            rounding=ROUND_HALF_UP,
        )
        total_debit = amount + fee

        available_balance = (
            sender.balance
            - getattr(sender, "reserved_balance", Decimal("0.00"))
        )

        if available_balance < total_debit:
            raise TransferError(
                "Insufficient available balance to cover the amount and fee."
            )

        # Daily principal limit, using UTC calendar days.
        now = datetime.now(timezone.utc)
        day_start = now.replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        daily_total = db.scalar(
            select(func.coalesce(func.sum(Transfer.amount), 0)).where(
                Transfer.sender_wallet_id == sender.id,
                Transfer.status == "completed",
                Transfer.created_at >= day_start,
            )
        )
        daily_total = Decimal(str(daily_total or 0))

        if daily_total + amount > TRANSFER_DAILY_LIMIT:
            raise TransferError(
                f"Daily transfer limit exceeded. Limit: "
                f"{TRANSFER_DAILY_LIMIT:.2f}; already transferred: "
                f"{daily_total:.2f}."
            )

        sender_account = db.scalar(
            select(LedgerAccount).where(
                LedgerAccount.wallet_id == sender.id
            )
        )
        receiver_account = db.scalar(
            select(LedgerAccount).where(
                LedgerAccount.wallet_id == receiver.id
            )
        )
        fee_account = db.scalar(
            select(LedgerAccount).where(
                LedgerAccount.account_code == "SYS-FEE-REVENUE"
            )
        )

        if sender_account is None or receiver_account is None:
            raise TransferError(
                "Sender or receiver ledger account is missing.", 500
            )

        if fee > 0 and fee_account is None:
            raise TransferError(
                "SYS-FEE-REVENUE ledger account is missing.", 500
            )

        reference = f"TRF-{uuid4().hex[:24].upper()}"

        entries = [
            {
                "ledger_account_id": sender_account.id,
                "side": "debit",
                "amount": total_debit,
            },
            {
                "ledger_account_id": receiver_account.id,
                "side": "credit",
                "amount": amount,
            },
        ]

        if fee > 0:
            entries.append({
                "ledger_account_id": fee_account.id,
                "side": "credit",
                "amount": fee,
            })

        transaction = post_transaction(
            db,
            reference=reference,
            transaction_type="transfer",
            description=note or (
                f"Transfer from {sender.wallet_number} "
                f"to {receiver.wallet_number}"
            ),
            entries=entries,
        )

        # Update both cached balances in the same database transaction.
        sender.balance -= total_debit
        receiver.balance += amount

        transfer = Transfer(
            reference=reference,
            sender_wallet_id=sender.id,
            receiver_wallet_id=receiver.id,
            amount=amount,
            fee=fee,
            note=note,
            status="completed",
            idempotency_key=idempotency_key,
            ledger_transaction_id=transaction.id,
        )
        db.add(transfer)
        db.flush()
        db.commit()

        db.refresh(transfer)
        db.refresh(sender)
        db.refresh(receiver)

        return _transfer_response(db, transfer, sender, receiver)

    except TransferError:
        db.rollback()
        raise

    except IntegrityError as exc:
        db.rollback()

        # Another request may have won the race to insert this key.
        existing = db.scalar(
            select(Transfer).where(
                Transfer.idempotency_key == idempotency_key
            )
        )

        if existing is not None:
            sender = db.get(Wallet, existing.sender_wallet_id)
            receiver = db.get(Wallet, existing.receiver_wallet_id)

            if (
                existing.sender_wallet_id != sender_initial.id
                or existing.receiver_wallet_id != receiver_initial.id
                or existing.amount != amount
            ):
                raise TransferError(
                    "Idempotency key was already used for a different transfer.",
                    409,
                ) from exc

            return _transfer_response(db, existing, sender, receiver)

        raise

    except Exception:
        db.rollback()
        raise
