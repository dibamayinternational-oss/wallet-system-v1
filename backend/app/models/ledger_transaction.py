
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Integer,
    String,
    Text,
    UniqueConstraint,
    ForeignKey,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class LedgerTransaction(Base):
    __tablename__ = "ledger_transactions"

    __table_args__ = (
        CheckConstraint(
            "transaction_type IN "
            "('deposit', 'withdrawal', 'transfer', 'fee', 'reversal', 'adjustment')",
            name="check_ledger_transaction_type",
        ),
        CheckConstraint(
            "status IN ('draft', 'posted', 'reversed')",
            name="check_ledger_transaction_status",
        ),
        UniqueConstraint(
            "idempotency_key",
            name="uq_ledger_transaction_idempotency_key",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    reference: Mapped[str] = mapped_column(
        String(40), unique=True, nullable=False
    )

    transaction_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft", server_default="draft"
    )

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # A client can send the same key when retrying a request.
    # The unique constraint prevents duplicate operations using that key.
    idempotency_key: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    posted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    
    reversal_of_transaction_id: Mapped[int | None] = mapped_column(
    ForeignKey("ledger_transactions.id"),
    nullable=True,
    unique=True,
)

    reversed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    reversal_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
)
