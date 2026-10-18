"""create transfers table

Revision ID: dcfa98673f17
Revises: a6719dc5553b
Create Date: 2026-10-18 12:28:04.215447

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dcfa98673f17'
down_revision: Union[str, Sequence[str], None] = 'a6719dc5553b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        "transfers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("reference", sa.String(length=100), nullable=False),
        sa.Column("sender_wallet_id", sa.Integer(), nullable=False),
        sa.Column("receiver_wallet_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("fee", sa.Numeric(18, 2), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="completed",
            nullable=False,
        ),
        sa.Column(
            "idempotency_key",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column("ledger_transaction_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("amount > 0", name="ck_transfers_amount_positive"),
        sa.CheckConstraint("fee >= 0", name="ck_transfers_fee_nonnegative"),
        sa.CheckConstraint(
            "sender_wallet_id != receiver_wallet_id",
            name="ck_transfers_different_wallets",
        ),
        sa.CheckConstraint(
            "status IN ('completed')",
            name="ck_transfers_status",
        ),
        sa.ForeignKeyConstraint(
            ["sender_wallet_id"], ["wallets.id"]
        ),
        sa.ForeignKeyConstraint(
            ["receiver_wallet_id"], ["wallets.id"]
        ),
        sa.ForeignKeyConstraint(
            ["ledger_transaction_id"], ["ledger_transactions.id"]
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("reference", name="uq_transfers_reference"),
        sa.UniqueConstraint(
            "idempotency_key",
            name="uq_transfers_idempotency_key",
        ),
        sa.UniqueConstraint(
            "ledger_transaction_id",
            name="uq_transfers_ledger_transaction_id",
        ),
    )

    op.create_index(
        "ix_transfers_sender_created_at",
        "transfers",
        ["sender_wallet_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_transfers_sender_created_at",
        table_name="transfers",
    )
    op.drop_table("transfers")