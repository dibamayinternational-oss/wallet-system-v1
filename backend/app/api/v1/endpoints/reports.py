
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin
from app.db.dependencies import get_db
from app.models.ledger_account import LedgerAccount
from app.models.ledger_entry import LedgerEntry
from app.models.ledger_transaction import LedgerTransaction
from app.models.transfer import Transfer
from app.models.user import User
from app.models.wallet import Wallet
from app.models.withdrawal import WithdrawalRequest


router = APIRouter(
    prefix="/admin/reports",
    tags=["Admin Reports and Reconciliation"],
)


def _date_range(
    start_date: date | None,
    end_date: date | None,
):
    """Convert inclusive calendar dates into a half-open UTC range."""
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date must not be after end_date.",
        )

    start = (
        datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        if start_date
        else None
    )
    end_exclusive = (
        datetime.combine(
            end_date + timedelta(days=1),
            time.min,
            tzinfo=timezone.utc,
        )
        if end_date
        else None
    )

    return start, end_exclusive


def _posted_transaction_totals():
    """One row per posted transaction, with its total debit amount."""
    return (
        select(
            LedgerEntry.transaction_id.label("transaction_id"),
            func.sum(
                case(
                    (LedgerEntry.side == "debit", LedgerEntry.amount),
                    else_=Decimal("0.00"),
                )
            ).label("debit_total"),
            func.sum(
                case(
                    (LedgerEntry.side == "credit", LedgerEntry.amount),
                    else_=Decimal("0.00"),
                )
            ).label("credit_total"),
        )
        .join(
            LedgerTransaction,
            LedgerTransaction.id == LedgerEntry.transaction_id,
        )
        .where(LedgerTransaction.status.in_(("posted", "reversed")))
        .group_by(LedgerEntry.transaction_id)
        .subquery()
    )


@router.get("/overview")
def reports_overview(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """High-level wallet and pending-withdrawal figures."""

    wallet_stats = db.execute(
        select(
            func.count(Wallet.id).label("wallet_count"),
            func.coalesce(
                func.sum(Wallet.balance), Decimal("0.00")
            ).label("cached_liabilities"),
            func.coalesce(
                func.sum(Wallet.reserved_balance), Decimal("0.00")
            ).label("reserved_amount"),
            func.sum(
                case((Wallet.status == "active", 1), else_=0)
            ).label("active_count"),
            func.sum(
                case((Wallet.status == "frozen", 1), else_=0)
            ).label("frozen_count"),
        )
    ).one()

    withdrawal_stats = db.execute(
        select(
            func.count(WithdrawalRequest.id).label("pending_count"),
            func.coalesce(
                func.sum(WithdrawalRequest.amount),
                Decimal("0.00"),
            ).label("pending_amount"),
        ).where(WithdrawalRequest.status == "pending")
    ).one()

    return {
        "as_of": datetime.now(timezone.utc),
        "wallets": {
            "total": wallet_stats.wallet_count or 0,
            "active": wallet_stats.active_count or 0,
            "frozen": wallet_stats.frozen_count or 0,
        },
        "balances": {
            "total_cached_wallet_liabilities":
                wallet_stats.cached_liabilities or Decimal("0.00"),
            "total_reserved_balance":
                wallet_stats.reserved_amount or Decimal("0.00"),
        },
        "pending_withdrawals": {
            "count": withdrawal_stats.pending_count or 0,
            "amount": withdrawal_stats.pending_amount or Decimal("0.00"),
        },
    }


@router.get("/daily-summary")
def daily_transaction_summary(
    start_date: date | None = None,
    end_date: date | None = None,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Summarize posted ledger activity by UTC date and transaction type.

    volume is total debit-side ledger movement, not necessarily
    the customer's principal amount for a transfer.
    """

    start, end_exclusive = _date_range(start_date, end_date)
    totals = _posted_transaction_totals()
    

    query = (
        select(
            func.date(LedgerTransaction.posted_at).label("day"),
            LedgerTransaction.transaction_type.label("type"),
            func.count(LedgerTransaction.id).label("count"),
            func.coalesce(
                func.sum(totals.c.debit_total),
                Decimal("0.00"),
            ).label("volume"),
        )
        .join(
            totals,
            totals.c.transaction_id == LedgerTransaction.id,
        )
        .where(
            LedgerTransaction.status.in_(("posted", "reversed")),
            LedgerTransaction.posted_at.is_not(None),
        )
    )

    if start:
        query = query.where(LedgerTransaction.posted_at >= start)

    if end_exclusive:
        query = query.where(
            LedgerTransaction.posted_at < end_exclusive
        )

    rows = db.execute(
        query.group_by(
            func.date(LedgerTransaction.posted_at),
            LedgerTransaction.transaction_type,
        ).order_by(
            func.date(LedgerTransaction.posted_at).desc(),
            LedgerTransaction.transaction_type,
        )
    ).all()

    return {
        "timezone": "UTC",
        "start_date": start_date,
        "end_date": end_date,
        "items": [
            {
                "date": row.day,
                "transaction_type": row.type,
                "transaction_count": row.count,
                "ledger_debit_volume": row.volume,
            }
            for row in rows
        ],
    }


@router.get("/trial-balance")
def trial_balance(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Report posted debit/credit totals and the normal balance
    of each ledger account.
    """

    totals = _posted_transaction_totals()

    account_totals = (
        select(
            LedgerEntry.ledger_account_id.label("account_id"),
            func.sum(
                case(
                    (LedgerEntry.side == "debit", LedgerEntry.amount),
                    else_=Decimal("0.00"),
                )
            ).label("debits"),
            func.sum(
                case(
                    (LedgerEntry.side == "credit", LedgerEntry.amount),
                    else_=Decimal("0.00"),
                )
            ).label("credits"),
        )
        .join(
            LedgerTransaction,
            LedgerTransaction.id == LedgerEntry.transaction_id,
        )
        .where(LedgerTransaction.status.in_(("posted", "reversed")))
        .group_by(LedgerEntry.ledger_account_id)
        .subquery()
    )

    rows = db.execute(
        select(
            LedgerAccount,
            account_totals.c.debits,
            account_totals.c.credits,
        )
        .outerjoin(
            account_totals,
            account_totals.c.account_id == LedgerAccount.id,
        )
        .order_by(LedgerAccount.account_code)
    ).all()

    items = []
    total_debits = Decimal("0.00")
    total_credits = Decimal("0.00")

    for account, debit_value, credit_value in rows:
        debits = debit_value or Decimal("0.00")
        credits = credit_value or Decimal("0.00")

        total_debits += debits
        total_credits += credits

        # Positive balances follow the account's normal balance.
        if account.normal_balance == "debit":
            balance = debits - credits
        else:
            balance = credits - debits

        items.append({
            "account_id": account.id,
            "account_code": account.account_code,
            "account_name": account.name,
            "account_type": account.account_type,
            "normal_balance": account.normal_balance,
            "total_debits": debits,
            "total_credits": credits,
            "normal_balance_amount": balance,
        })

    difference = total_debits - total_credits

    return {
        "basis": "posted ledger entries only",
        "account_count": len(items),
        "total_debits": total_debits,
        "total_credits": total_credits,
        "difference": difference,
        "balanced": difference == Decimal("0.00"),
        "accounts": items,
    }


@router.get("/reconciliation")
def reconcile_wallet_balances(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    only_mismatches: bool = True,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Compare each cached wallet balance against its posted ledger balance.

    Wallet ledger accounts are liabilities with credit-normal balances.
    Reserved funds are excluded from this comparison because reservations
    do not post ledger entries.
    """

    ledger_balances = (
        select(
            LedgerAccount.wallet_id.label("wallet_id"),
            func.coalesce(
                func.sum(
                    case(
                        (LedgerEntry.side == "credit", LedgerEntry.amount),
                        (LedgerEntry.side == "debit", -LedgerEntry.amount),
                        else_=Decimal("0.00"),
                    )
                ),
                Decimal("0.00"),
            ).label("ledger_balance"),
        )
        .join(
            LedgerEntry,
            LedgerEntry.ledger_account_id == LedgerAccount.id,
        )
        .join(
            LedgerTransaction,
            LedgerTransaction.id == LedgerEntry.transaction_id,
        )
        .where(
            LedgerAccount.wallet_id.is_not(None),
            LedgerTransaction.status.in_(("posted", "reversed")),
        )
        .group_by(LedgerAccount.wallet_id)
        .subquery()
    )

    # Include wallets with no ledger account or no posted entries.
    query = (
        select(
            Wallet.id.label("wallet_id"),
            Wallet.wallet_number,
            Wallet.balance.label("cached_balance"),
            Wallet.reserved_balance,
            Wallet.status,
            ledger_balances.c.ledger_balance,
        )
        .outerjoin(
            ledger_balances,
            ledger_balances.c.wallet_id == Wallet.id,
        )
    )

    if only_mismatches:
        query = query.where(
            Wallet.balance
            != func.coalesce(
                ledger_balances.c.ledger_balance,
                Decimal("0.00"),
            )
        )

    total = db.scalar(
        select(func.count()).select_from(query.subquery())
    ) or 0

    rows = db.execute(
        query.order_by(Wallet.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = []

    for row in rows:
        ledger_balance = (
            row.ledger_balance
            if row.ledger_balance is not None
            else Decimal("0.00")
        )
        difference = row.cached_balance - ledger_balance

        items.append({
            "wallet_id": row.wallet_id,
            "wallet_number": row.wallet_number,
            "status": row.status,
            "cached_balance": row.cached_balance,
            "ledger_balance": ledger_balance,
            "difference": difference,
            "reserved_balance": row.reserved_balance,
            "matches": difference == Decimal("0.00"),
        })

    return {
        "only_mismatches": only_mismatches,
        "total_wallets_in_result": total,
        "page": page,
        "page_size": page_size,
        "items": items,
    }
