"""add withdrawal requests and reserved balance

Revision ID: 172a336aa2ec
Revises: 98b9195e1e87
Create Date: 2026-10-17 12:46:57.599974

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '172a336aa2ec'
down_revision = "98b9195e1e87"
# down_revision: Union[str, Sequence[str], None] = '98b9195e1e87'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column(
        "wallets",
        sa.Column(
            "reserved_balance",
            sa.Numeric(18, 2),
            server_default="0.00",
            nullable=False,
        ),
    )

    op.create_check_constraint(
        "check_wallet_reserved_balance",
        "wallets",
        "reserved_balance >= 0 AND reserved_balance <= balance",
    )

    op.create_table(
        "withdrawal_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reference", sa.String(40), nullable=False),
        sa.Column("wallet_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("idempotency_key", sa.String(100), nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'completed', 'approved', 'rejected')",
            name="check_withdrawal_request_status",
        ),
        sa.ForeignKeyConstraint(["wallet_id"], ["wallets.id"]),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["ledger_transactions.id"],
        ),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.UniqueConstraint(
            "reference",
            name="uq_withdrawal_request_reference",
        ),
        sa.UniqueConstraint(
            "idempotency_key",
            name="uq_withdrawal_request_idempotency_key",
        ),
        sa.UniqueConstraint(
            "transaction_id",
            name="uq_withdrawal_request_transaction_id",
        ),
    )

    op.create_index(
        "ix_withdrawal_requests_wallet_id",
        "withdrawal_requests",
        ["wallet_id"],
    )

    op.create_index(
        "ix_withdrawal_requests_status_created_at",
        "withdrawal_requests",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_withdrawal_requests_status_created_at",
        table_name="withdrawal_requests",
    )

    op.drop_index(
        "ix_withdrawal_requests_wallet_id",
        table_name="withdrawal_requests",
    )

    op.drop_table("withdrawal_requests")

    op.drop_constraint(
        "check_wallet_reserved_balance",
        "wallets",
        type_="check",
    )

    op.drop_column("wallets", "reserved_balance")