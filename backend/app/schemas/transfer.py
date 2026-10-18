
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing import Annotated


WalletNumber = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=20),
]


class TransferCreate(BaseModel):
    receiver_wallet_number: WalletNumber

    amount: Decimal = Field(
        gt=0,
        max_digits=18,
        decimal_places=2,
    )

    note: str | None = Field(
        default=None,
        max_length=500,
    )


class TransferResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reference: str
    sender_wallet_number: str
    receiver_wallet_number: str
    amount: Decimal
    fee: Decimal
    total_debit: Decimal
    note: str | None
    status: str
    ledger_transaction_reference: str
    sender_balance: Decimal
    receiver_balance: Decimal
    created_at: object
