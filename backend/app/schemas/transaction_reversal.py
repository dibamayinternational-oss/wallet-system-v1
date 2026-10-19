from pydantic import BaseModel, Field, ConfigDict


class TransactionReversalRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


class TransactionReversalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    original_transaction_id: int
    original_reference: str
    reversal_transaction_id: int
    reversal_reference: str
    status: str
    reason: str
    reversed_by_user_id: int