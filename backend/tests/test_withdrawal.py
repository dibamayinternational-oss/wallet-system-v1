
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Import models so SQLAlchemy registers all tables and foreign keys.
from app.db.session import Base
from app.models.user import User
from app.models.wallet import Wallet
from app.models.ledger_account import LedgerAccount
from app.models.ledger_transaction import LedgerTransaction
from app.models.ledger_entry import LedgerEntry
from app.models.withdrawal import WithdrawalRequest
from app.services.withdrawal import (
    WithdrawalError,
    request_withdrawal,
    approve_withdrawal,
    reject_withdrawal,
)


@pytest.fixture
def db():
    """Create a fresh isolated database for each test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    TestingSessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        expire_on_commit=False,
    )

    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def setup_wallet(db):
    """Create a customer, admin, funded wallet and ledger accounts."""
    customer = User(
        full_name="Withdrawal Test User",
        email="withdrawal-test@example.com",
        hashed_password="test-hash",
        role="user",
        is_active=True,
    )

    admin = User(
        full_name="Withdrawal Test Admin",
        email="withdrawal-admin@example.com",
        hashed_password="test-hash",
        role="admin",
        is_active=True,
    )

    db.add_all([customer, admin])
    db.flush()

    wallet = Wallet(
        user_id=customer.id,
        wallet_number="WALLET-WD-001",
        balance=Decimal("200000.00"),
        reserved_balance=Decimal("0.00"),
        status="active",
    )
    db.add(wallet)
    db.flush()

    wallet_account = LedgerAccount(
        account_code="TEST-WD-WALLET",
        name="Withdrawal Test Customer Wallet",
        account_type="liability",
        normal_balance="credit",
        wallet_id=wallet.id,
        is_system=False,
    )

    cash_account = LedgerAccount(
        account_code="SYS-CASH",
        name="Withdrawal Test System Cash",
        account_type="asset",
        normal_balance="debit",
        wallet_id=None,
        is_system=True,
    )

    db.add_all([wallet_account, cash_account])
    db.commit()

    return {
        "customer": customer,
        "admin": admin,
        "wallet": wallet,
    }


def ledger_transaction_count(db):
    return db.scalar(
        select(func.count()).select_from(LedgerTransaction)
    )


def ledger_entry_count(db):
    return db.scalar(
        select(func.count()).select_from(LedgerEntry)
    )


def create_withdrawal(db, customer, amount, key):
    return request_withdrawal(
        db,
        user_id=customer.id,
        amount=Decimal(amount),
        idempotency_key=key,
    )


def test_small_withdrawal_completes_immediately(db, setup_wallet):
    customer = setup_wallet["customer"]
    wallet = setup_wallet["wallet"]

    result = create_withdrawal(
        db, customer, "1000.00", "wd-small-test-001"
    )

    db.refresh(wallet)
    withdrawal = db.get(WithdrawalRequest, result["id"])

    assert withdrawal.status == "completed"
    assert withdrawal.transaction_id is not None
    assert wallet.balance == Decimal("199000.00")
    assert wallet.reserved_balance == Decimal("0.00")
    assert ledger_transaction_count(db) == 1
    assert ledger_entry_count(db) == 2

    transaction = db.get(
        LedgerTransaction, withdrawal.transaction_id
    )
    assert transaction.status == "posted"
    assert transaction.transaction_type == "withdrawal"


def test_large_withdrawal_reserves_funds_without_posting_ledger(
    db, setup_wallet
):
    customer = setup_wallet["customer"]
    wallet = setup_wallet["wallet"]

    # Above the 100,000.00 approval limit, so this stays pending.
    result = create_withdrawal(
        db, customer, "150000.00", "wd-large-test-001"
    )

    db.refresh(wallet)
    withdrawal = db.get(WithdrawalRequest, result["id"])

    assert withdrawal.status == "pending"
    assert withdrawal.transaction_id is None
    assert wallet.balance == Decimal("200000.00")
    assert wallet.reserved_balance == Decimal("150000.00")
    assert wallet.available_balance == Decimal("50000.00")
    assert ledger_transaction_count(db) == 0
    assert ledger_entry_count(db) == 0


def test_withdrawal_rejects_insufficient_available_balance(
    db, setup_wallet
):
    customer = setup_wallet["customer"]
    wallet = setup_wallet["wallet"]

    # Reserve 150,000.00, leaving only 50,000.00 available.
    create_withdrawal(
        db, customer, "150000.00", "wd-reserve-test-001"
    )

    # A further 60,000.00 exceeds the available balance.
    with pytest.raises(WithdrawalError):
        create_withdrawal(
            db, customer, "60000.00", "wd-insufficient-test-001"
        )

    db.refresh(wallet)
    assert wallet.balance == Decimal("200000.00")
    assert wallet.reserved_balance == Decimal("150000.00")
    assert wallet.available_balance == Decimal("50000.00")


def test_retry_with_same_idempotency_key_does_not_withdraw_twice(
    db, setup_wallet
):
    customer = setup_wallet["customer"]
    wallet = setup_wallet["wallet"]
    key = "wd-idempotency-test-001"

    first = create_withdrawal(db, customer, "1000.00", key)
    second = create_withdrawal(db, customer, "1000.00", key)

    db.refresh(wallet)

    assert first["id"] == second["id"]
    assert wallet.balance == Decimal("199000.00")
    assert ledger_transaction_count(db) == 1
    assert ledger_entry_count(db) == 2


def test_reusing_idempotency_key_with_different_amount_fails(
    db, setup_wallet
):
    customer = setup_wallet["customer"]
    key = "wd-idempotency-test-002"

    create_withdrawal(db, customer, "1000.00", key)

    with pytest.raises(WithdrawalError):
        create_withdrawal(db, customer, "2000.00", key)


def test_admin_approval_posts_transaction_and_releases_reservation(
    db, setup_wallet
):
    customer = setup_wallet["customer"]
    admin = setup_wallet["admin"]
    wallet = setup_wallet["wallet"]

    result = create_withdrawal(
        db, customer, "150000.00", "wd-approve-test-001"
    )

    db.refresh(wallet)
    assert wallet.balance == Decimal("200000.00")
    assert wallet.reserved_balance == Decimal("150000.00")

    approve_withdrawal(
        db,
        withdrawal_id=result["id"],
        admin=admin,
    )

    db.refresh(wallet)
    withdrawal = db.get(WithdrawalRequest, result["id"])

    assert withdrawal.status == "approved"
    assert withdrawal.transaction_id is not None
    assert withdrawal.reviewed_by == admin.id
    assert withdrawal.reviewed_at is not None
    assert wallet.balance == Decimal("50000.00")
    assert wallet.reserved_balance == Decimal("0.00")
    assert ledger_transaction_count(db) == 1
    assert ledger_entry_count(db) == 2

    transaction = db.get(
        LedgerTransaction, withdrawal.transaction_id
    )
    assert transaction.status == "posted"


def test_admin_rejection_releases_reservation_without_ledger(
    db, setup_wallet
):
    customer = setup_wallet["customer"]
    admin = setup_wallet["admin"]
    wallet = setup_wallet["wallet"]

    result = create_withdrawal(
        db, customer, "150000.00", "wd-reject-test-001"
    )

    db.refresh(wallet)
    assert wallet.balance == Decimal("200000.00")
    assert wallet.reserved_balance == Decimal("150000.00")

    reject_withdrawal(
        db,
        withdrawal_id=result["id"],
        admin=admin,
        reason="Automated test rejection",
    )

    db.refresh(wallet)
    withdrawal = db.get(WithdrawalRequest, result["id"])

    assert withdrawal.status == "rejected"
    assert withdrawal.transaction_id is None
    assert withdrawal.reviewed_by == admin.id
    assert withdrawal.reviewed_at is not None
    assert withdrawal.rejection_reason == "Automated test rejection"
    assert wallet.balance == Decimal("200000.00")
    assert wallet.reserved_balance == Decimal("0.00")
    assert ledger_transaction_count(db) == 0
    assert ledger_entry_count(db) == 0


def test_rejected_withdrawal_cannot_be_approved_again(
    db, setup_wallet
):
    customer = setup_wallet["customer"]
    admin = setup_wallet["admin"]

    result = create_withdrawal(
        db, customer, "150000.00", "wd-terminal-test-001"
    )

    reject_withdrawal(
        db,
        withdrawal_id=result["id"],
        admin=admin,
        reason="Reject for terminal-state test",
    )

    with pytest.raises(WithdrawalError):
        approve_withdrawal(
            db,
            withdrawal_id=result["id"],
            admin=admin,
        )

    assert ledger_transaction_count(db) == 0
    assert ledger_entry_count(db) == 0
