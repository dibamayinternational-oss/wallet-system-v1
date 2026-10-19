
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base
from app.models.user import User
from app.models.wallet import Wallet
from app.models.ledger_account import LedgerAccount
from app.models.ledger_transaction import LedgerTransaction
from app.models.ledger_entry import LedgerEntry
from app.models.transfer import Transfer
from app.services.transfer import (
    TransferError,
    preview_recipient,
    transfer_money,
)


@pytest.fixture
def db():
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
    sender_user = User(
        full_name="Transfer Sender",
        email="sender-transfer-test@example.com",
        hashed_password="test-hash",
        role="user",
        is_active=True,
    )
    receiver_user = User(
        full_name="Transfer Receiver",
        email="receiver-transfer-test@example.com",
        hashed_password="test-hash",
        role="user",
        is_active=True,
    )
    db.add_all([sender_user, receiver_user])
    db.flush()

    sender = Wallet(
        user_id=sender_user.id,
        wallet_number="WALLET-TR-SENDER",
        balance=Decimal("20000.00"),
        reserved_balance=Decimal("0.00"),
        status="active",
    )
    receiver = Wallet(
        user_id=receiver_user.id,
        wallet_number="WALLET-TR-RECEIVER",
        balance=Decimal("1000.00"),
        reserved_balance=Decimal("0.00"),
        status="active",
    )
    db.add_all([sender, receiver])
    db.flush()

    db.add_all([
        LedgerAccount(
            account_code="TEST-TR-SENDER",
            name="Test Sender Wallet",
            account_type="liability",
            normal_balance="credit",
            wallet_id=sender.id,
            is_system=False,
        ),
        LedgerAccount(
            account_code="TEST-TR-RECEIVER",
            name="Test Receiver Wallet",
            account_type="liability",
            normal_balance="credit",
            wallet_id=receiver.id,
            is_system=False,
        ),
        LedgerAccount(
            account_code="SYS-FEE-REVENUE",
            name="System Fee Revenue",
            account_type="revenue",
            normal_balance="credit",
            wallet_id=None,
            is_system=True,
        ),
    ])
    db.commit()

    return {
        "sender_user": sender_user,
        "receiver_user": receiver_user,
        "sender": sender,
        "receiver": receiver,
    }


def make_transfer(db, sender_user, amount, key, receiver_number="WALLET-TR-RECEIVER"):
    return transfer_money(
        db,
        sender_user_id=sender_user.id,
        receiver_wallet_number=receiver_number,
        amount=Decimal(amount),
        note="Automated transfer test",
        idempotency_key=key,
    )


def test_recipient_preview(db, accounts):
    result = preview_recipient(
        db,
        sender_user_id=accounts["sender_user"].id,
        receiver_wallet_number="WALLET-TR-RECEIVER",
    )

    assert result["receiver_name"] == "Transfer Receiver"
    assert result["wallet_status"] == "active"
    assert result["can_receive"] is True


def test_successful_transfer_and_balanced_ledger(db, accounts):
    sender = accounts["sender"]
    receiver = accounts["receiver"]

    result = make_transfer(
        db, accounts["sender_user"], "1000.00", "tr-test-success-001"
    )

    db.refresh(sender)
    db.refresh(receiver)

    assert result["amount"] == Decimal("1000.00")
    assert result["fee"] == Decimal("5.00")
    assert result["total_debit"] == Decimal("1005.00")
    assert sender.balance == Decimal("18995.00")
    assert receiver.balance == Decimal("2000.00")

    transfer = db.scalar(
        select(Transfer).where(Transfer.reference == result["reference"])
    )
    transaction = db.get(
        LedgerTransaction, transfer.ledger_transaction_id
    )

    assert transfer.status == "completed"
    assert transaction.status == "posted"
    assert transaction.transaction_type == "transfer"

    entries = db.scalars(
        select(LedgerEntry).where(
            LedgerEntry.transaction_id == transaction.id
        )
    ).all()

    assert len(entries) == 3
    debits = sum(
        (entry.amount for entry in entries if entry.side == "debit"),
        Decimal("0.00"),
    )
    credits = sum(
        (entry.amount for entry in entries if entry.side == "credit"),
        Decimal("0.00"),
    )
    assert debits == credits == Decimal("1005.00")


def test_sender_cannot_transfer_to_self(db, accounts):
    with pytest.raises(TransferError):
        make_transfer(
            db,
            accounts["sender_user"],
            "100.00",
            "tr-test-self-001",
            receiver_number="WALLET-TR-SENDER",
        )


def test_frozen_sender_is_rejected(db, accounts):
    sender = accounts["sender"]
    sender.status = "frozen"
    db.commit()

    with pytest.raises(TransferError):
        make_transfer(
            db, accounts["sender_user"], "100.00", "tr-test-frozen-s-001"
        )

    db.refresh(sender)
    assert sender.balance == Decimal("20000.00")


def test_frozen_receiver_is_rejected(db, accounts):
    receiver = accounts["receiver"]
    receiver.status = "frozen"
    db.commit()

    with pytest.raises(TransferError):
        make_transfer(
            db, accounts["sender_user"], "100.00", "tr-test-frozen-r-001"
        )

    db.refresh(accounts["sender"])
    assert accounts["sender"].balance == Decimal("20000.00")


def test_insufficient_available_balance_is_rejected(db, accounts):
    sender = accounts["sender"]
    sender.balance = Decimal("100.00")
    sender.reserved_balance = Decimal("50.00")
    db.commit()

    # Only 50.00 is available; the amount plus fee is 60.60.
    with pytest.raises(TransferError):
        make_transfer(
            db, accounts["sender_user"], "60.00", "tr-test-insufficient-001"
        )

    db.refresh(sender)
    assert sender.balance == Decimal("100.00")
    assert sender.reserved_balance == Decimal("50.00")


def test_idempotency_retry_does_not_transfer_twice(db, accounts):
    sender = accounts["sender"]
    receiver = accounts["receiver"]
    key = "tr-test-idempotent-001"

    first = make_transfer(db, accounts["sender_user"], "1000.00", key)
    second = make_transfer(db, accounts["sender_user"], "1000.00", key)

    db.refresh(sender)
    db.refresh(receiver)

    assert first["reference"] == second["reference"]
    assert sender.balance == Decimal("18995.00")
    assert receiver.balance == Decimal("2000.00")

    assert db.scalar(
        select(func.count()).select_from(Transfer)
    ) == 1

    assert db.scalar(
        select(func.count()).select_from(LedgerTransaction)
    ) == 1


def test_same_key_with_different_amount_is_rejected(db, accounts):
    key = "tr-test-conflict-001"

    make_transfer(db, accounts["sender_user"], "1000.00", key)

    with pytest.raises(TransferError):
        make_transfer(db, accounts["sender_user"], "500.00", key)


def test_daily_transfer_limit_is_enforced(db, accounts, monkeypatch):
    import app.services.transfer as transfer_service

    monkeypatch.setattr(
        transfer_service,
        "TRANSFER_DAILY_LIMIT",
        Decimal("1500.00"),
    )

    make_transfer(
        db, accounts["sender_user"], "1000.00", "tr-test-daily-001"
    )

    with pytest.raises(TransferError):
        make_transfer(
            db, accounts["sender_user"], "600.00", "tr-test-daily-002"
        )

    db.refresh(accounts["sender"])
    db.refresh(accounts["receiver"])

    assert accounts["sender"].balance == Decimal("18995.00")
    assert accounts["receiver"].balance == Decimal("2000.00")


def test_inactive_receiver_user_is_rejected(db, accounts):
    receiver_user = accounts["receiver_user"]
    receiver_user.is_active = False
    db.commit()

    with pytest.raises(TransferError):
        make_transfer(
            db, accounts["sender_user"], "100.00", "tr-test-inactive-001"
        )

    db.refresh(accounts["sender"])
    assert accounts["sender"].balance == Decimal("20000.00")
