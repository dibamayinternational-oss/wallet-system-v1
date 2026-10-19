from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class TransactionHistoryItem(BaseModel):
    transaction_id: int
    date: datetime
    type: str
    status: str
    reference: str
    description: str | None = None
    debit: Decimal
    credit: Decimal
    running_balance: Decimal | None = None

    sender_name: str | None = None
    sender_email: str | None = None
    sender_wallet_number: str | None = None
    receiver_name: str | None = None
    receiver_email: str | None = None
    receiver_wallet_number: str | None = None

    reversal_of_transaction_id: int | None = None
    reversal_of_reference: str | None = None
    reversed_by_user_id: int | None = None
    reversal_reason: str | None = None


class TransactionHistoryPage(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[TransactionHistoryItem]
    total: int
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)
    wallet_number: str | None = None
