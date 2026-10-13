from decimal import Decimal

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.user import User
from app.models.wallet import Wallet


def backfill_wallets():
    db = SessionLocal()

    try:
        users_without_wallets = db.scalars(
            select(User)
            .outerjoin(Wallet, User.id == Wallet.user_id)
            .where(Wallet.id.is_(None))
        ).all()

        created_count = 0

        for user in users_without_wallets:
            wallet = Wallet(
                user_id=user.id,
                wallet_number=f"WAL-{100000 + user.id}",
                balance=Decimal("0.00"),
                status="active",
            )
            db.add(wallet)
            created_count += 1

        db.commit()

        print(f"Created {created_count} missing wallet(s).")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    backfill_wallets()