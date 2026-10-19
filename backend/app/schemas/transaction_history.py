from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class TransactionHistoryItem(BaseModel):
    transaction_id: int
    reference: str
    transaction_type: str
    status: str
    created_at: datetime
    amount: Decimal
    debit: Decimal
    credit: Decimal
    running_balance: Decimal
    description: str | None = None
    sender_name: str | None = None
    receiver_name: str | None = None
    sender_wallet_number: str | None = None
    receiver_wallet_number: str | None = None
    reversal_of_transaction_id: int | None = None
    reversal_reason: str | None = None


class TransactionHistoryResponse(BaseModel):
    items: list[TransactionHistoryItem]
    page: int
    page_size: int
    total: int