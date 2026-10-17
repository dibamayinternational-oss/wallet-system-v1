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


class WithdrawalRequest(Base):
    __tablename__ = "withdrawal_requests"

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'completed', 'approved', 'rejected')",
            name="check_withdrawal_request_status",
        ),
        UniqueConstraint(
            "reference",
            name="uq_withdrawal_request_reference",
        ),
        UniqueConstraint(
            "idempotency_key",
            name="uq_withdrawal_request_idempotency_key",
        ),
        UniqueConstraint(
            "transaction_id",
            name="uq_withdrawal_request_transaction_id",
        ),
        Index(
            "ix_withdrawal_requests_status_created_at",
            "status",
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

    wallet_id: Mapped[int] = mapped_column(
        ForeignKey("wallets.id"),
        nullable=False,
        index=True,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        server_default="pending",
    )

    idempotency_key: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("ledger_transactions.id"),
        nullable=True,
    )

    reviewed_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    rejection_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )