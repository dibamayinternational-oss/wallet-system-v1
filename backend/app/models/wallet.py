
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


class Wallet(Base):
    __tablename__ = "wallets"

    __table_args__ = (
        CheckConstraint(
            "balance >= 0",
            name="check_wallet_balance_nonnegative",
        ),
        CheckConstraint(
            "status IN ('active', 'frozen')",
            name="check_wallet_status",
        ),
        CheckConstraint(
            "reserved_balance >= 0 AND reserved_balance <= balance",
            name="check_wallet_reserved_balance",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
    )

    wallet_number: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
    )

    balance: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default="0.00",
    )

    reserved_balance: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default="0.00",
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="active",
        server_default="active",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    
    @property
    def available_balance(self) -> Decimal:
        return self.balance - self.reserved_balance