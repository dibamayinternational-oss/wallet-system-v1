
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base



class LedgerAccount(Base):
    __tablename__ = "ledger_accounts"

    __table_args__ = (
        CheckConstraint(
            "account_type IN "
            "('asset', 'liability', 'equity', 'revenue', 'expense')",
            name="check_ledger_account_type",
        ),
        CheckConstraint(
            "normal_balance IN ('debit', 'credit')",
            name="check_ledger_normal_balance",
        ),
        UniqueConstraint(
            "wallet_id",
            name="uq_ledger_account_wallet_id",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    account_code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    account_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    normal_balance: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )

    wallet_id: Mapped[int | None] = mapped_column(
        ForeignKey("wallets.id"),
        nullable=True,
    )

    is_system: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )