from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class WithdrawalCreate(BaseModel):
    amount: Decimal = Field(
        gt=0,
        max_digits=18,
        decimal_places=2,
        description="Withdrawal amount",
    )


class WithdrawalRejectRequest(BaseModel):
    reason: str | None = Field(
        default=None,
        max_length=500,
    )


class WithdrawalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reference: str
    wallet_number: str
    user_id: int
    amount: Decimal
    status: str
    transaction_reference: str | None
    balance: Decimal
    reserved_balance: Decimal
    available_balance: Decimal
    created_at: datetime
    reviewed_at: datetime | None
    reviewed_by: int | None
    rejection_reason: str | None
    