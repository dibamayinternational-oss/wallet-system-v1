
# from fastapi import APIRouter, Depends, Header, HTTPException, status

# from decimal import Decimal
# from uuid import uuid4

# from sqlalchemy import select
# from sqlalchemy.orm import Session

# from app.models.wallet import Wallet
# from app.models.ledger_account import LedgerAccount
# from app.services.ledger import post_transaction


# def deposit_money(
#     db: Session,
#     *,
#     user_id: int,
#     amount: Decimal,
# ) -> dict:
#     if not isinstance(amount, Decimal):
#         raise ValueError("Amount must be a Decimal.")

#     if not amount.is_finite() or amount <= 0:
#         raise ValueError("Deposit amount must be greater than zero.")

#     if amount != amount.quantize(Decimal("0.01")):
#         raise ValueError("Deposit amount cannot have more than 2 decimal places.")

#     try:
#         # Lock the wallet to prevent concurrent operations racing on its balance.
#         wallet = db.scalar(
#             select(Wallet)
#             .where(Wallet.user_id == user_id)
#             .with_for_update()
#         )

#         if wallet is None:
#             raise ValueError("Wallet not found.")

#         if wallet.status != "active":
#             raise ValueError("Wallet is frozen.")

#         wallet_account = db.scalar(
#             select(LedgerAccount).where(
#                 LedgerAccount.wallet_id == wallet.id
#             )
#         )

#         cash_account = db.scalar(
#             select(LedgerAccount).where(
#                 LedgerAccount.account_code == "SYS-CASH"
#             )
#         )

#         if wallet_account is None or cash_account is None:
#             raise ValueError("Required ledger accounts have not been configured.")

#         transaction = post_transaction(
#             db,
#             reference=f"DEP-{uuid4().hex[:24].upper()}",
#             transaction_type="deposit",
#             description=f"Deposit to {wallet.wallet_number}",
#             entries=[
#                 {
#                     "ledger_account_id": cash_account.id,
#                     "side": "debit",
#                     "amount": amount,
#                 },
#                 {
#                     "ledger_account_id": wallet_account.id,
#                     "side": "credit",
#                     "amount": amount,
#                 },
#             ],
#         )

#         wallet.balance += amount
#         db.commit()
#         db.refresh(wallet)

#         return {
#             "transaction_reference": transaction.reference,
#             "amount": amount,
#             "wallet_number": wallet.wallet_number,
#             "new_balance": wallet.balance,
#             "status": transaction.status,
#         }

#     except Exception:
#         db.rollback()
#         raise


from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.wallet import Wallet
from app.models.ledger_account import LedgerAccount
from app.models.ledger_entry import LedgerEntry
from app.models.ledger_transaction import LedgerTransaction
from app.services.ledger import post_transaction


def _existing_deposit_response(
    db: Session,
    *,
    transaction: LedgerTransaction,
    wallet: Wallet,
    wallet_account: LedgerAccount,
    cash_account: LedgerAccount,
    amount: Decimal,
) -> dict:
    """Validate a repeated key and return the existing deposit result."""

    if (
        transaction.transaction_type != "deposit"
        or transaction.status != "posted"
    ):
        raise ValueError(
            "Idempotency-Key has already been used for another transaction."
        )

    entries = db.scalars(
        select(LedgerEntry).where(
            LedgerEntry.transaction_id == transaction.id
        )
    ).all()

    is_same_request = (
        len(entries) == 2
        and any(
            entry.ledger_account_id == cash_account.id
            and entry.side == "debit"
            and entry.amount == amount
            for entry in entries
        )
        and any(
            entry.ledger_account_id == wallet_account.id
            and entry.side == "credit"
            and entry.amount == amount
            for entry in entries
        )
    )

    if not is_same_request:
        raise ValueError(
            "Idempotency-Key has already been used for a different deposit request."
        )

    return {
        "transaction_reference": transaction.reference,
        "amount": amount,
        "wallet_number": wallet.wallet_number,
        "new_balance": wallet.balance,
        "status": transaction.status,
    }


def deposit_money(
    db: Session,
    *,
    user_id: int,
    amount: Decimal,
    idempotency_key: str,
) -> dict:
    if not isinstance(amount, Decimal):
        raise ValueError("Amount must be a Decimal.")

    if not amount.is_finite() or amount <= 0:
        raise ValueError("Deposit amount must be greater than zero.")

    if amount != amount.quantize(Decimal("0.01")):
        raise ValueError("Deposit amount cannot have more than 2 decimal places.")

    if (
        not idempotency_key
        or idempotency_key.strip() != idempotency_key
        or len(idempotency_key) < 8
        or len(idempotency_key) > 100
    ):
        raise ValueError("Invalid Idempotency-Key.")

    try:
        # Lock the wallet to serialize concurrent deposits to this wallet.
        wallet = db.scalar(
            select(Wallet)
            .where(Wallet.user_id == user_id)
            .with_for_update()
        )

        if wallet is None:
            raise ValueError("Wallet not found.")

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

        # A matching committed transaction means this is a retry.
        existing = db.scalar(
            select(LedgerTransaction).where(
                LedgerTransaction.idempotency_key == idempotency_key
            )
        )

        if existing is not None:
            return _existing_deposit_response(
                db,
                transaction=existing,
                wallet=wallet,
                wallet_account=wallet_account,
                cash_account=cash_account,
                amount=amount,
            )

        if wallet.status != "active":
            raise ValueError("Wallet is frozen.")

        transaction = post_transaction(
            db,
            reference=f"DEP-{uuid4().hex[:24].upper()}",
            transaction_type="deposit",
            description=f"Deposit to {wallet.wallet_number}",
            idempotency_key=idempotency_key,
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

    except IntegrityError:
        # Another concurrent request may have inserted this key first.
        db.rollback()

        existing = db.scalar(
            select(LedgerTransaction).where(
                LedgerTransaction.idempotency_key == idempotency_key
            )
        )

        if existing is None:
            # The integrity error wasn't caused by this idempotency key.
            raise

        # Reload the data after rollback; ORM objects may have expired.
        try:
            wallet = db.scalar(
                select(Wallet).where(Wallet.user_id == user_id)
            )
            if wallet is None:
                raise ValueError("Wallet not found.")

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
                raise ValueError(
                    "Required ledger accounts have not been configured."
                )

            response = _existing_deposit_response(
                db,
                transaction=existing,
                wallet=wallet,
                wallet_account=wallet_account,
                cash_account=cash_account,
                amount=amount,
            )
            db.rollback()
            return response

        except Exception:
            db.rollback()
            raise

    except Exception:
        db.rollback()
        raise
