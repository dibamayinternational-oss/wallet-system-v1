
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.wallet import Wallet
from app.models.ledger_account import LedgerAccount
from app.services.ledger import post_transaction


def deposit_money(
    db: Session,
    *,
    user_id: int,
    amount: Decimal,
) -> dict:
    if not isinstance(amount, Decimal):
        raise ValueError("Amount must be a Decimal.")

    if not amount.is_finite() or amount <= 0:
        raise ValueError("Deposit amount must be greater than zero.")

    if amount != amount.quantize(Decimal("0.01")):
        raise ValueError("Deposit amount cannot have more than 2 decimal places.")

    try:
        # Lock the wallet to prevent concurrent operations racing on its balance.
        wallet = db.scalar(
            select(Wallet)
            .where(Wallet.user_id == user_id)
            .with_for_update()
        )

        if wallet is None:
            raise ValueError("Wallet not found.")

        if wallet.status != "active":
            raise ValueError("Wallet is frozen.")

        wallet_account = db.scalar(
            select(LedgerAccount).where(
                LedgerAccount.wallet_id == wallet.id
            )
        )

        cash_account = db.scalar(
            select(LedgerAccount).where(
                LedgerAccount.account_code == "SYS-CASH"
            )
        )

        if wallet_account is None or cash_account is None:
            raise ValueError("Required ledger accounts have not been configured.")

        transaction = post_transaction(
            db,
            reference=f"DEP-{uuid4().hex[:24].upper()}",
            transaction_type="deposit",
            description=f"Deposit to {wallet.wallet_number}",
            entries=[
                {
                    "ledger_account_id": cash_account.id,
                    "side": "debit",
                    "amount": amount,
                },
                {
                    "ledger_account_id": wallet_account.id,
                    "side": "credit",
                    "amount": amount,
                },
            ],
        )

        wallet.balance += amount
        db.commit()
        db.refresh(wallet)

        return {
            "transaction_reference": transaction.reference,
            "amount": amount,
            "wallet_number": wallet.wallet_number,
            "new_balance": wallet.balance,
            "status": transaction.status,
        }

    except Exception:
        db.rollback()
        raise
