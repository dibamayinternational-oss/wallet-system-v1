
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.ledger_account import LedgerAccount

from app.models.wallet import Wallet  # Register wallets table metadata

SYSTEM_ACCOUNTS = [
    {
        "account_code": "SYS-CASH",
        "name": "System Cash",
        "account_type": "asset",
        "normal_balance": "debit",
    },
    {
        "account_code": "SYS-EQUITY",
        "name": "Opening Capital",
        "account_type": "equity",
        "normal_balance": "credit",
    },
]


def seed_system_accounts():
    with SessionLocal() as db:
        created = 0

        for data in SYSTEM_ACCOUNTS:
            existing = db.scalar(
                select(LedgerAccount).where(
                    LedgerAccount.account_code == data["account_code"]
                )
            )

            if existing:
                continue

            db.add(
                LedgerAccount(
                    **data,
                    wallet_id=None,
                    is_system=True,
                )
            )
            created += 1

        db.commit()
        print(f"Created {created} system account(s).")


if __name__ == "__main__":
    seed_system_accounts()
