from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import WITHDRAWAL_APPROVAL_LIMIT
from app.models.ledger_account import LedgerAccount
from app.models.ledger_transaction import LedgerTransaction
from app.models.user import User
from app.models.wallet import Wallet
from app.models.withdrawal import WithdrawalRequest
from app.services.ledger import post_transaction


class WithdrawalError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def _response(
    db: Session,
    request: WithdrawalRequest,
    wallet: Wallet,
) -> dict:
    transaction = (
        db.get(LedgerTransaction, request.transaction_id)
        if request.transaction_id is not None
        else None
    )

    return {
        "id": request.id,
        "reference": request.reference,
        "wallet_number": wallet.wallet_number,
        "user_id": wallet.user_id,
        "amount": request.amount,
        "status": request.status,
        "transaction_reference": (
            transaction.reference if transaction else None
        ),
        "balance": wallet.balance,
        "reserved_balance": wallet.reserved_balance,
        "available_balance": wallet.available_balance,
        "created_at": request.created_at,
        "reviewed_at": request.reviewed_at,
        "reviewed_by": request.reviewed_by,
        "rejection_reason": request.rejection_reason,
    }


def _get_withdrawal_accounts(
    db: Session,
    wallet: Wallet,
) -> tuple[LedgerAccount, LedgerAccount]:
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
        raise WithdrawalError(
            "Required ledger accounts have not been configured.",
            500,
        )

    return wallet_account, cash_account


def _post_withdrawal_transaction(
    db: Session,
    *,
    request: WithdrawalRequest,
    wallet: Wallet,
) -> LedgerTransaction:
    wallet_account, cash_account = _get_withdrawal_accounts(
        db, wallet
    )

    # A withdrawal reduces the wallet liability and the system's cash.
    return post_transaction(
        db,
        reference=request.reference,
        transaction_type="withdrawal",
        description=f"Withdrawal from {wallet.wallet_number}",
        entries=[
            {
                "ledger_account_id": wallet_account.id,
                "side": "debit",
                "amount": request.amount,
            },
            {
                "ledger_account_id": cash_account.id,
                "side": "credit",
                "amount": request.amount,
            },
        ],
    )


def _validate_existing_request(
    request: WithdrawalRequest,
    *,
    wallet: Wallet,
    amount: Decimal,
) -> None:
    if request.wallet_id != wallet.id or request.amount != amount:
        raise WithdrawalError(
            "Idempotency-Key has already been used for a different request.",
            409,
        )


def request_withdrawal(
    db: Session,
    *,
    user_id: int,
    amount: Decimal,
    idempotency_key: str,
) -> dict:
    if not isinstance(amount, Decimal):
        raise WithdrawalError("Amount must be a Decimal.")

    if not amount.is_finite() or amount <= 0:
        raise WithdrawalError(
            "Withdrawal amount must be greater than zero."
        )

    if amount != amount.quantize(Decimal("0.01")):
        raise WithdrawalError(
            "Withdrawal amount cannot have more than 2 decimal places."
        )

    if (
        not idempotency_key
        or idempotency_key.strip() != idempotency_key
        or len(idempotency_key) < 8
        or len(idempotency_key) > 100
    ):
        raise WithdrawalError("Invalid Idempotency-Key.")

    try:
        # Serialize withdrawals against other money operations on this wallet.
        wallet = db.scalar(
            select(Wallet)
            .where(Wallet.user_id == user_id)
            .with_for_update()
        )

        if wallet is None:
            raise WithdrawalError("Wallet not found.", 404)

        # Check retries before applying current wallet status or balance rules.
        existing = db.scalar(
            select(WithdrawalRequest).where(
                WithdrawalRequest.idempotency_key == idempotency_key
            )
        )

        if existing is not None:
            _validate_existing_request(
                existing,
                wallet=wallet,
                amount=amount,
            )
            result = _response(db, existing, wallet)
            db.rollback()
            return result

        if wallet.status != "active":
            raise WithdrawalError("Wallet is frozen.", 409)

        available_balance = wallet.balance - wallet.reserved_balance

        if amount > available_balance:
            raise WithdrawalError(
                "Insufficient available balance."
            )

        reference = f"WDR-{uuid4().hex[:24].upper()}"

        # Small withdrawals complete immediately; large ones need approval.
        needs_approval = amount > WITHDRAWAL_APPROVAL_LIMIT

        withdrawal = WithdrawalRequest(
            reference=reference,
            wallet_id=wallet.id,
            amount=amount,
            status="pending" if needs_approval else "completed",
            idempotency_key=idempotency_key,
        )

        db.add(withdrawal)
        db.flush()

        if needs_approval:
            # Reserve funds, but do not move money in the ledger yet.
            wallet.reserved_balance += amount
        else:
            transaction = _post_withdrawal_transaction(
                db,
                request=withdrawal,
                wallet=wallet,
            )
            wallet.balance -= amount
            withdrawal.transaction_id = transaction.id

        db.commit()
        db.refresh(withdrawal)
        db.refresh(wallet)

        return _response(db, withdrawal, wallet)

    except IntegrityError:
        db.rollback()

        # Handle a concurrent request that won the idempotency-key race.
        existing = db.scalar(
            select(WithdrawalRequest).where(
                WithdrawalRequest.idempotency_key == idempotency_key
            )
        )

        if existing is None:
            raise

        wallet = db.scalar(
            select(Wallet).where(Wallet.user_id == user_id)
        )

        if wallet is None:
            raise WithdrawalError("Wallet not found.", 404)

        _validate_existing_request(
            existing,
            wallet=wallet,
            amount=amount,
        )

        result = _response(db, existing, wallet)
        db.rollback()
        return result

    except Exception:
        db.rollback()
        raise


def list_my_withdrawals(
    db: Session,
    *,
    user_id: int,
) -> list[dict]:
    wallet = db.scalar(
        select(Wallet).where(Wallet.user_id == user_id)
    )

    if wallet is None:
        raise WithdrawalError("Wallet not found.", 404)

    requests = db.scalars(
        select(WithdrawalRequest)
        .where(WithdrawalRequest.wallet_id == wallet.id)
        .order_by(WithdrawalRequest.created_at.desc())
    ).all()

    return [
        _response(db, request, wallet)
        for request in requests
    ]


def list_pending_withdrawals(db: Session) -> list[dict]:
    rows = db.execute(
        select(WithdrawalRequest, Wallet)
        .join(Wallet, Wallet.id == WithdrawalRequest.wallet_id)
        .where(WithdrawalRequest.status == "pending")
        .order_by(WithdrawalRequest.created_at.asc())
    ).all()

    return [
        _response(db, request, wallet)
        for request, wallet in rows
    ]


def approve_withdrawal(
    db: Session,
    *,
    withdrawal_id: int,
    admin: User,
) -> dict:
    try:
        request = db.scalar(
            select(WithdrawalRequest)
            .where(WithdrawalRequest.id == withdrawal_id)
            .with_for_update()
        )

        if request is None:
            raise WithdrawalError("Withdrawal request not found.", 404)

        if request.status != "pending":
            raise WithdrawalError(
                "Only pending withdrawals can be approved.",
                409,
            )

        wallet = db.scalar(
            select(Wallet)
            .where(Wallet.id == request.wallet_id)
            .with_for_update()
        )

        if wallet is None:
            raise WithdrawalError("Wallet not found.", 404)

        if wallet.status != "active":
            raise WithdrawalError(
                "This wallet is frozen. Reject the request to release its reserved funds.",
                409,
            )

        if (
            wallet.reserved_balance < request.amount
            or wallet.balance < request.amount
        ):
            raise WithdrawalError(
                "Wallet balances are inconsistent; approval was stopped.",
                409,
            )

        transaction = _post_withdrawal_transaction(
            db,
            request=request,
            wallet=wallet,
        )

        wallet.balance -= request.amount
        wallet.reserved_balance -= request.amount

        request.status = "approved"
        request.transaction_id = transaction.id
        request.reviewed_by = admin.id
        request.reviewed_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(request)
        db.refresh(wallet)

        return _response(db, request, wallet)

    except Exception:
        db.rollback()
        raise


def reject_withdrawal(
    db: Session,
    *,
    withdrawal_id: int,
    admin: User,
    reason: str | None = None,
) -> dict:
    try:
        request = db.scalar(
            select(WithdrawalRequest)
            .where(WithdrawalRequest.id == withdrawal_id)
            .with_for_update()
        )

        if request is None:
            raise WithdrawalError("Withdrawal request not found.", 404)

        if request.status != "pending":
            raise WithdrawalError(
                "Only pending withdrawals can be rejected.",
                409,
            )

        wallet = db.scalar(
            select(Wallet)
            .where(Wallet.id == request.wallet_id)
            .with_for_update()
        )

        if wallet is None:
            raise WithdrawalError("Wallet not found.", 404)

        if wallet.reserved_balance < request.amount:
            raise WithdrawalError(
                "Reserved balance is inconsistent; rejection was stopped.",
                409,
            )

        wallet.reserved_balance -= request.amount

        request.status = "rejected"
        request.reviewed_by = admin.id
        request.reviewed_at = datetime.now(timezone.utc)
        request.rejection_reason = reason.strip() if reason else None

        db.commit()
        db.refresh(request)
        db.refresh(wallet)

        return _response(db, request, wallet)

    except Exception:
        db.rollback()
        raise