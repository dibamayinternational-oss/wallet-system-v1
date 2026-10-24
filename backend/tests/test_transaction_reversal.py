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
from app.services.transfer import transfer_money
from app.services.transaction_reversal import ReversalError, reverse_transfer


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
def scenario(db):
    sender_user = User(
        full_name="Reversal Sender",
        email="reversal-sender@example.com",
        hashed_password="test-hash",
        role="user",
        is_active=True,
    )
    receiver_user = User(
        full_name="Reversal Receiver",
        email="reversal-receiver@example.com",
        hashed_password="test-hash",
        role="user",
        is_active=True,
    )
    admin = User(
        full_name="Reversal Admin",
        email="reversal-admin@example.com",
        hashed_password="test-hash",
        role="admin",
        is_active=True,
    )
    db.add_all([sender_user, receiver_user, admin])
    db.flush()

    sender = Wallet(
        user_id=sender_user.id,
        wallet_number="WALLET-REV-SENDER",
        balance=Decimal("20000.00"),
        reserved_balance=Decimal("0.00"),
        status="active",
    )
    receiver = Wallet(
        user_id=receiver_user.id,
        wallet_number="WALLET-REV-RECEIVER",
        balance=Decimal("1000.00"),
        reserved_balance=Decimal("0.00"),
        status="active",
    )
    db.add_all([sender, receiver])
    db.flush()

    sender_account = LedgerAccount(
        account_code="TEST-REV-SENDER",
        name="Reversal Sender Wallet",
        account_type="liability",
        normal_balance="credit",
        wallet_id=sender.id,
        is_system=False,
    )
    receiver_account = LedgerAccount(
        account_code="TEST-REV-RECEIVER",
        name="Reversal Receiver Wallet",
        account_type="liability",
        normal_balance="credit",
        wallet_id=receiver.id,
        is_system=False,
    )
    fee_account = LedgerAccount(
        account_code="SYS-FEE-REVENUE",
        name="Reversal Fee Revenue",
        account_type="revenue",
        normal_balance="credit",
        wallet_id=None,
        is_system=True,
    )
    db.add_all([sender_account, receiver_account, fee_account])
    db.commit()

    result = transfer_money(
        db,
        sender_user_id=sender_user.id,
        receiver_wallet_number=receiver.wallet_number,
        amount=Decimal("100.00"),
        note="Automated reversal test",
        idempotency_key="reversal-test-transfer-001",
    )
    transfer = db.scalar(
        select(Transfer).where(Transfer.reference == result["reference"])
    )
    original = db.get(LedgerTransaction, transfer.ledger_transaction_id)

    return {
        "sender_user": sender_user,
        "receiver_user": receiver_user,
        "admin": admin,
        "sender": sender,
        "receiver": receiver,
        "sender_account": sender_account,
        "receiver_account": receiver_account,
        "fee_account": fee_account,
        "transfer": transfer,
        "original": original,
        "initial_sender_balance": Decimal("20000.00"),
        "initial_receiver_balance": Decimal("1000.00"),
    }


def count_reversals(db, original_id):
    # Requires reversal_of_transaction_id to be added to LedgerTransaction.
    return db.scalar(
        select(func.count())
        .select_from(LedgerTransaction)
        .where(LedgerTransaction.reversal_of_transaction_id == original_id)
    )


def test_successful_reversal_creates_inverse_balanced_ledger(db, scenario):
    original = scenario["original"]
    sender = scenario["sender"]
    receiver = scenario["receiver"]

    original_entries_before = db.scalars(
        select(LedgerEntry).where(LedgerEntry.transaction_id == original.id)
    ).all()
    original_snapshot = [
        (e.ledger_account_id, e.side, e.amount)
        for e in original_entries_before
    ]

    result = reverse_transfer(
        db,
        transaction_id=original.id,
        admin_user_id=scenario["admin"].id,
        reason="Incorrect recipient",
    )

    db.refresh(original)
    db.refresh(sender)
    db.refresh(receiver)

    reversal = db.get(
        LedgerTransaction, result["reversal_transaction_id"]
    )
    reversal_entries = db.scalars(
        select(LedgerEntry).where(
            LedgerEntry.transaction_id == reversal.id
        )
    ).all()

    # assert original.status == "reversed"
    assert original.status == "posted"
    assert reversal.transaction_type == "reversal"
    assert reversal.status == "posted"
    assert reversal.reversal_of_transaction_id == original.id
    assert count_reversals(db, original.id) == 1
    assert reversal.reversed_by_user_id == scenario["admin"].id
    assert reversal.reversal_reason == "Incorrect recipient"

    assert sum(
        (e.amount for e in reversal_entries if e.side == "debit"),
        Decimal("0.00"),
    ) == sum(
        (e.amount for e in reversal_entries if e.side == "credit"),
        Decimal("0.00"),
    )

    # The original ledger rows must not be edited or deleted.
    original_entries_after = db.scalars(
        select(LedgerEntry).where(LedgerEntry.transaction_id == original.id)
    ).all()
    assert [
        (e.ledger_account_id, e.side, e.amount)
        for e in original_entries_after
    ] == original_snapshot

    # Transfer principal and fee are both returned to the sender.
    db.refresh(scenario["transfer"])
    assert sender.balance == scenario["initial_sender_balance"]
    assert receiver.balance == scenario["initial_receiver_balance"]
    assert count_reversals(db, original.id) == 1


def test_duplicate_reversal_is_rejected_without_second_reversal(db, scenario):
    original = scenario["original"]
    admin = scenario["admin"]

    reverse_transfer(
        db,
        transaction_id=original.id,
        admin_user_id=admin.id,
        reason="Incorrect recipient",
    )
    with pytest.raises(ReversalError):
        reverse_transfer(
            db,
            transaction_id=original.id,
            admin_user_id=admin.id,
            reason="Duplicate attempt",
        )

    assert count_reversals(db, original.id) == 1


def test_non_admin_cannot_reverse(db, scenario):
    with pytest.raises(ReversalError):
        reverse_transfer(
            db,
            transaction_id=scenario["original"].id,
            admin_user_id=scenario["sender_user"].id,
            reason="Not an administrator",
        )

    assert count_reversals(db, scenario["original"].id) == 0


def test_insufficient_receiver_available_balance_rolls_back(db, scenario):
    receiver = scenario["receiver"]
    receiver.balance = Decimal("50.00")
    receiver.reserved_balance = Decimal("0.00")
    db.commit()

    sender_before = scenario["sender"].balance
    receiver_before = receiver.balance
    entry_count_before = db.scalar(
        select(func.count()).select_from(LedgerEntry)
    )

    with pytest.raises(ReversalError):
        reverse_transfer(
            db,
            transaction_id=scenario["original"].id,
            admin_user_id=scenario["admin"].id,
            reason="Receiver already spent the funds",
        )

    db.refresh(scenario["sender"])
    db.refresh(receiver)
    assert scenario["sender"].balance == sender_before
    assert receiver.balance == receiver_before
    assert db.scalar(select(func.count()).select_from(LedgerEntry)) == entry_count_before
    assert count_reversals(db, scenario["original"].id) == 0


@pytest.mark.parametrize("transaction_type", ["deposit", "withdrawal"])
def test_non_transfer_transaction_is_not_eligible(db, scenario, transaction_type):
    ineligible = LedgerTransaction(
        reference=f"TEST-{transaction_type.upper()}-INELIGIBLE",
        transaction_type=transaction_type,
        status="posted",
        description="Ineligible transaction",
    )
    db.add(ineligible)
    db.commit()

    with pytest.raises(ReversalError):
        reverse_transfer(
            db,
            transaction_id=ineligible.id,
            admin_user_id=scenario["admin"].id,
            reason="Must not reverse this",
        )

    assert count_reversals(db, ineligible.id) == 0


def test_reason_must_be_valid(db, scenario):
    with pytest.raises(ReversalError):
        reverse_transfer(
            db,
            transaction_id=scenario["original"].id,
            admin_user_id=scenario["admin"].id,
            reason="  ",
        )

    assert count_reversals(db, scenario["original"].id) == 0
