# from datetime import datetime
# from decimal import Decimal

# from pydantic import BaseModel, ConfigDict


# class WalletResponse(BaseModel):
#     model_config = ConfigDict(from_attributes=True)

#     id: int
#     wallet_number: str
#     balance: Decimal
#     status: str
#     created_at: datetime

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class WalletResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    wallet_number: str
    balance: Decimal
    reserved_balance: Decimal
    available_balance: Decimal
    status: str
    created_at: datetime