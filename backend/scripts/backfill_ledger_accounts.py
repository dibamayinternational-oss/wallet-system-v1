
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.wallet import Wallet
from app.models.ledger_account import LedgerAccount


def backfill_ledger_accounts():
    with SessionLocal() as db:
        wallets = db.scalars(select(Wallet)).all()
        created = 0

        for wallet in wallets:
            existing = db.scalar(
                select(LedgerAccount).where(
                    LedgerAccount.wallet_id == wallet.id
                )
            )

            if existing:
                continue

            account = LedgerAccount(
                account_code=f"WALLET-{wallet.id}",
                name=f"Wallet {wallet.wallet_number}",
                account_type="liability",
                normal_balance="credit",
                wallet_id=wallet.id,
                is_system=False,
            )
            db.add(account)
            created += 1

        db.commit()
        print(f"Created {created} ledger account(s).")


if __name__ == "__main__":
    backfill_ledger_accounts()
