
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Import all models so SQLAlchemy registers their tables and foreign keys.
from app.db.session import Base
from app.models.user import User
from app.models.wallet import Wallet
from app.models.ledger_account import LedgerAccount
from app.models.ledger_transaction import LedgerTransaction
from app.models.ledger_entry import LedgerEntry
from app.services.ledger import post_transaction


@pytest.fixture
def db():
    """Create a fresh, isolated SQLite database for each test."""
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
def accounts(db):
    """Create two system-style ledger accounts for testing."""
    cash = LedgerAccount(
        account_code="TEST-CASH",
        name="Test Cash",
        account_type="asset",
        normal_balance="debit",
        wallet_id=None,
        is_system=True,
    )
    customer_wallet = LedgerAccount(
        account_code="TEST-WALLET",
        name="Test Customer Wallet",
        account_type="liability",
        normal_balance="credit",
        wallet_id=None,
        is_system=True,
    )

    db.add_all([cash, customer_wallet])
    db.flush()

    return {
        "cash": cash,
        "wallet": customer_wallet,
    }


def transaction_count(db):
    return db.scalar(
        select(func.count()).select_from(LedgerTransaction)
    )


def entry_count(db):
    return db.scalar(
        select(func.count()).select_from(LedgerEntry)
    )


def test_posts_a_balanced_transaction(db, accounts):
    amount = Decimal("100.00")

    transaction = post_transaction(
        db,
        reference="TEST-DEP-001",
        transaction_type="deposit",
        description="Test deposit",
        entries=[
            {
                "ledger_account_id": accounts["cash"].id,
                "side": "debit",
                "amount": amount,
            },
            {
                "ledger_account_id": accounts["wallet"].id,
                "side": "credit",
                "amount": amount,
            },
        ],
    )

    assert transaction.reference == "TEST-DEP-001"
    assert transaction.transaction_type == "deposit"
    assert transaction.status == "posted"
    assert transaction.posted_at is not None

    entries = db.scalars(
        select(LedgerEntry).where(
            LedgerEntry.transaction_id == transaction.id
        )
    ).all()

    assert len(entries) == 2
    assert sum(
        (e.amount for e in entries if e.side == "debit"),
        Decimal("0.00"),
    ) == amount
    assert sum(
        (e.amount for e in entries if e.side == "credit"),
        Decimal("0.00"),
    ) == amount


def test_rejects_unbalanced_transaction(db, accounts):
    with pytest.raises(ValueError):
        post_transaction(
            db,
            reference="TEST-UNBALANCED",
            transaction_type="deposit",
            entries=[
                {
                    "ledger_account_id": accounts["cash"].id,
                    "side": "debit",
                    "amount": Decimal("100.00"),
                },
                {
                    "ledger_account_id": accounts["wallet"].id,
                    "side": "credit",
                    "amount": Decimal("90.00"),
                },
            ],
        )

    assert transaction_count(db) == 0
    assert entry_count(db) == 0


def test_rejects_fewer_than_two_entries(db, accounts):
    with pytest.raises(ValueError):
        post_transaction(
            db,
            reference="TEST-ONE-ENTRY",
            transaction_type="deposit",
            entries=[
                {
                    "ledger_account_id": accounts["cash"].id,
                    "side": "debit",
                    "amount": Decimal("100.00"),
                }
            ],
        )

    assert transaction_count(db) == 0
    assert entry_count(db) == 0


@pytest.mark.parametrize(
    "amount",
    [
        Decimal("0.00"),
        Decimal("-10.00"),
        Decimal("10.001"),
        Decimal("NaN"),
        Decimal("Infinity"),
    ],
)
def test_rejects_invalid_amounts(db, accounts, amount):
    with pytest.raises(ValueError):
        post_transaction(
            db,
            reference="TEST-INVALID-AMOUNT",
            transaction_type="deposit",
            entries=[
                {
                    "ledger_account_id": accounts["cash"].id,
                    "side": "debit",
                    "amount": amount,
                },
                {
                    "ledger_account_id": accounts["wallet"].id,
                    "side": "credit",
                    "amount": amount,
                },
            ],
        )

    assert transaction_count(db) == 0
    assert entry_count(db) == 0


def test_rejects_invalid_entry_side(db, accounts):
    with pytest.raises(ValueError):
        post_transaction(
            db,
            reference="TEST-INVALID-SIDE",
            transaction_type="deposit",
            entries=[
                {
                    "ledger_account_id": accounts["cash"].id,
                    "side": "invalid",
                    "amount": Decimal("10.00"),
                },
                {
                    "ledger_account_id": accounts["wallet"].id,
                    "side": "credit",
                    "amount": Decimal("10.00"),
                },
            ],
        )

    assert transaction_count(db) == 0
    assert entry_count(db) == 0


def test_rejects_nonexistent_ledger_account(db, accounts):
    with pytest.raises(ValueError):
        post_transaction(
            db,
            reference="TEST-MISSING-ACCOUNT",
            transaction_type="deposit",
            entries=[
                {
                    "ledger_account_id": 999999,
                    "side": "debit",
                    "amount": Decimal("10.00"),
                },
                {
                    "ledger_account_id": accounts["wallet"].id,
                    "side": "credit",
                    "amount": Decimal("10.00"),
                },
            ],
        )

    assert transaction_count(db) == 0
    assert entry_count(db) == 0


def test_rejects_unknown_transaction_type(db, accounts):
    with pytest.raises(ValueError):
        post_transaction(
            db,
            reference="TEST-INVALID-TYPE",
            transaction_type="not_a_transaction",
            entries=[
                {
                    "ledger_account_id": accounts["cash"].id,
                    "side": "debit",
                    "amount": Decimal("10.00"),
                },
                {
                    "ledger_account_id": accounts["wallet"].id,
                    "side": "credit",
                    "amount": Decimal("10.00"),
                },
            ],
        )

    assert transaction_count(db) == 0
    assert entry_count(db) == 0


def test_service_does_not_commit_automatically(db, accounts):
    post_transaction(
        db,
        reference="TEST-ROLLBACK",
        transaction_type="deposit",
        entries=[
            {
                "ledger_account_id": accounts["cash"].id,
                "side": "debit",
                "amount": Decimal("25.00"),
            },
            {
                "ledger_account_id": accounts["wallet"].id,
                "side": "credit",
                "amount": Decimal("25.00"),
            },
        ],
    )

    # The service flushes its changes, but the caller owns the commit.
    assert transaction_count(db) == 1
    assert entry_count(db) == 2

    db.rollback()

    assert transaction_count(db) == 0
    assert entry_count(db) == 0
