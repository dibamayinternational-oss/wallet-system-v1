
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Transfer(Base):
    __tablename__ = "transfers"

    __table_args__ = (
        CheckConstraint(
            "amount > 0",
            name="check_transfer_amount_positive",
        ),
        CheckConstraint(
            "fee >= 0",
            name="check_transfer_fee_nonnegative",
        ),
        CheckConstraint(
            "sender_wallet_id != receiver_wallet_id",
            name="check_transfer_not_self",
        ),
        CheckConstraint(
            "status IN ('completed')",
            name="check_transfer_status",
        ),
        UniqueConstraint(
            "reference",
            name="uq_transfer_reference",
        ),
        UniqueConstraint(
            "idempotency_key",
            name="uq_transfer_idempotency_key",
        ),
        UniqueConstraint(
            "ledger_transaction_id",
            name="uq_transfer_ledger_transaction_id",
        ),
        Index(
            "ix_transfers_sender_created_at",
            "sender_wallet_id",
            "created_at",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    reference: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    sender_wallet_id: Mapped[int] = mapped_column(
        ForeignKey("wallets.id"),
        nullable=False,
    )

    receiver_wallet_id: Mapped[int] = mapped_column(
        ForeignKey("wallets.id"),
        nullable=False,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
    )

    fee: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
    )

    note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="completed",
        server_default="completed",
    )

    idempotency_key: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    ledger_transaction_id: Mapped[int] = mapped_column(
        ForeignKey("ledger_transactions.id"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
