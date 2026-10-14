
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ledger_account import LedgerAccount
from app.models.ledger_entry import LedgerEntry
from app.models.ledger_transaction import LedgerTransaction


CENT = Decimal("0.01")


def post_transaction(
    db: Session,
    *,
    reference: str,
    transaction_type: str,
    entries: list[dict],
    description: str | None = None,
    idempotency_key: str | None = None,
) -> LedgerTransaction:
    """
    Validate and post a balanced double-entry transaction.

    Each entry must contain:
        ledger_account_id: int
        side: "debit" or "credit"
        amount: Decimal
    """

    allowed_types = {
        "deposit", "withdrawal", "transfer",
        "fee", "reversal", "adjustment",
    }

    if transaction_type not in allowed_types:
        raise ValueError("Invalid transaction type.")

    if len(entries) < 2:
        raise ValueError("A transaction requires at least two entries.")

    total_debits = Decimal("0.00")
    total_credits = Decimal("0.00")
    normalized_entries = []

    for entry in entries:
        side = entry.get("side")
        amount = entry.get("amount")
        account_id = entry.get("ledger_account_id")

        if side not in {"debit", "credit"}:
            raise ValueError("Entry side must be debit or credit.")

        if not isinstance(amount, Decimal):
            raise ValueError("Entry amounts must be Decimal values.")

        if not amount.is_finite() or amount <= 0:
            raise ValueError("Entry amount must be a positive finite amount.")

        if amount != amount.quantize(CENT):
            raise ValueError("Entry amount cannot have more than 2 decimal places.")

        if not isinstance(account_id, int) or isinstance(account_id, bool) or account_id <= 0:
            raise ValueError("Invalid ledger account ID.")

        if side == "debit":
            total_debits += amount
        else:
            total_credits += amount

        normalized_entries.append({
            "ledger_account_id": account_id,
            "side": side,
            "amount": amount,
        })

    if total_debits != total_credits:
        raise ValueError(
            f"Transaction is unbalanced: debits={total_debits}, "
            f"credits={total_credits}."
        )

    if total_debits <= 0:
        raise ValueError("Transaction total must be greater than zero.")

    account_ids = {entry["ledger_account_id"] for entry in normalized_entries}
    found_ids = set(
        db.scalars(
            select(LedgerAccount.id).where(LedgerAccount.id.in_(account_ids))
        ).all()
    )

    if found_ids != account_ids:
        raise ValueError("One or more ledger accounts do not exist.")

    transaction = LedgerTransaction(
        reference=reference,
        transaction_type=transaction_type,
        status="draft",
        description=description,
        idempotency_key=idempotency_key,
    )

    db.add(transaction)
    db.flush()  # Obtain the transaction ID before inserting its entries.

    for entry in normalized_entries:
        db.add(
            LedgerEntry(
                transaction_id=transaction.id,
                ledger_account_id=entry["ledger_account_id"],
                side=entry["side"],
                amount=entry["amount"],
            )
        )

    db.flush()  # Ensure all entries were inserted successfully.

    transaction.status = "posted"
    transaction.posted_at = datetime.now(timezone.utc)

    db.flush()
    return transaction
