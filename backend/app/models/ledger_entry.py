
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    __table_args__ = (
        CheckConstraint(
            "side IN ('debit', 'credit')",
            name="check_ledger_entry_side",
        ),
        CheckConstraint(
            "amount > 0",
            name="check_ledger_entry_amount_positive",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("ledger_transactions.id"), nullable=False, index=True
    )

    ledger_account_id: Mapped[int] = mapped_column(
        ForeignKey("ledger_accounts.id"), nullable=False, index=True
    )

    side: Mapped[str] = mapped_column(String(10), nullable=False)

    # Never use float for money.
    amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
