
"""create wallets table

Revision ID: cf64be2c3a44
Revises: 8e9b143f0379
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "cf64be2c3a44"
down_revision: Union[str, Sequence[str], None] = "8e9b143f0379"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "wallets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "wallet_number",
            sa.String(length=20),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "balance",
            sa.Numeric(18, 2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "balance >= 0",
            name="check_wallet_balance_nonnegative",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'frozen')",
            name="check_wallet_status",
        ),
    )


def downgrade() -> None:
    op.drop_table("wallets")