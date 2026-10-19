from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ledger_account import LedgerAccount
from app.models.ledger_entry import LedgerEntry
from app.models.ledger_transaction import LedgerTransaction
from app.models.transfer import Transfer
from app.models.user import User
from app.models.wallet import Wallet
from app.services.ledger import post_transaction


class ReversalError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def reverse_transfer(
    db: Session,
    *,
    transaction_id: int,
    admin_user_id: int,
    reason: str,
) -> dict:
    reason = reason.strip()
    if len(reason) < 5 or len(reason) > 500:
        raise ReversalError("Reason must contain 5–500 characters.")

    try:
        admin = db.get(User, admin_user_id)
        if admin is None or admin.role != "admin" or not admin.is_active:
            raise ReversalError("Active admin required.", 403)

        original = db.scalar(
            select(LedgerTransaction)
            .where(LedgerTransaction.id == transaction_id)
            .with_for_update()
        )
        if original is None:
            raise ReversalError("Transaction not found.", 404)

        if original.transaction_type != "transfer":
            raise ReversalError(
                "Only user-to-user transfers can be reversed."
            )

        if original.status != "posted":
            raise ReversalError(
                "Only posted transfers that have not been reversed are eligible."
            )

        transfer = db.scalar(
            select(Transfer).where(
                Transfer.ledger_transaction_id == original.id
            )
        )
        if transfer is None or transfer.status != "completed":
            raise ReversalError("Completed transfer record not found.")

        entries = db.scalars(
            select(LedgerEntry)
            .where(LedgerEntry.transaction_id == original.id)
            .order_by(LedgerEntry.id)
        ).all()

        if not entries:
            raise ReversalError("Original ledger entries are missing.", 409)

        debit_total = sum(
            (e.amount for e in entries if e.side == "debit"),
            Decimal("0.00"),
        )
        credit_total = sum(
            (e.amount for e in entries if e.side == "credit"),
            Decimal("0.00"),
        )
        if debit_total <= 0 or debit_total != credit_total:
            raise ReversalError("Original ledger is not balanced.", 409)

        sender_account = db.scalar(
            select(LedgerAccount).where(
                LedgerAccount.wallet_id == transfer.sender_wallet_id
            )
        )
        receiver_account = db.scalar(
            select(LedgerAccount).where(
                LedgerAccount.wallet_id == transfer.receiver_wallet_id
            )
        )

        if sender_account is None or receiver_account is None:
            raise ReversalError("Transfer wallet ledger account missing.", 409)

        # Lock wallets in a consistent order to reduce deadlocks.
        wallet_ids = sorted([
            transfer.sender_wallet_id,
            transfer.receiver_wallet_id,
        ])
        wallets = db.scalars(
            select(Wallet)
            .where(Wallet.id.in_(wallet_ids))
            .order_by(Wallet.id)
            .with_for_update()
        ).all()
        by_id = {w.id: w for w in wallets}
        sender = by_id.get(transfer.sender_wallet_id)
        receiver = by_id.get(transfer.receiver_wallet_id)

        if sender is None or receiver is None:
            raise ReversalError("Transfer wallet not found.", 409)

        if sender.status != "active" or receiver.status != "active":
            raise ReversalError(
                "Both transfer wallets must be active.",
                409,
            )

        sender_user = db.get(User, sender.user_id)
        receiver_user = db.get(User, receiver.user_id)

        if sender_user is None or receiver_user is None:
            raise ReversalError(
                "Transfer wallet owner not found.",
                409,
            )

        if not sender_user.is_active or not receiver_user.is_active:
            raise ReversalError(
                "Both transfer owners must be active.",
                409,
            )
        

        # A receiver cannot return funds that are no longer available.
        reserved = receiver.reserved_balance
        if receiver.balance - reserved < transfer.amount:
            raise ReversalError(
                "Receiver has insufficient available funds to reverse.",
                409,
            )

        # Build an exact inverse of every original ledger entry.
        inverse_entries = [
            {
                "ledger_account_id": e.ledger_account_id,
                "side": "credit" if e.side == "debit" else "debit",
                "amount": e.amount,
            }
            for e in entries
        ]

        reversal = post_transaction(
            db,
            reference=f"REV-{uuid4().hex[:24].upper()}",
            transaction_type="reversal",
            description=f"Reversal of {original.reference}: {reason}",
            entries=inverse_entries,
            reversal_of_transaction_id=original.id,
            reversed_by_user_id=admin_user_id,
            reversal_reason=reason,
        )
        # reversal.reversal_of_transaction_id = original.id
        # reversal.reversed_by_user_id = admin_user_id
        # reversal.reversal_reason = reason

        # The sender gets the principal plus fee back.
        sender.balance += transfer.amount + transfer.fee
        receiver.balance -= transfer.amount

        # Mark the original as reversed. Do not edit or delete its entries.
        original.status = "reversed"

        db.flush()

        result = {
            "original_transaction_id": original.id,
            "original_reference": original.reference,
            "reversal_transaction_id": reversal.id,
            "reversal_reference": reversal.reference,
            "status": "reversed",
            "reason": reason,
            "reversed_by_user_id": admin_user_id,
        }

        db.commit()
        return result

    except ReversalError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise