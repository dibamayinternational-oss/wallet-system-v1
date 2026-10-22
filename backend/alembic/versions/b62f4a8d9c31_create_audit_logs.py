
"""create audit logs

Revision ID: b62f4a8d9c31
Revises: 584264b60f00
"""

from alembic import op
import sqlalchemy as sa


revision = "b62f4a8d9c31"
down_revision = "584264b60f00"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "actor_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "target_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "wallet_id",
            sa.Integer(),
            sa.ForeignKey("wallets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(length=60), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_audit_logs_created_at",
        "audit_logs",
        ["created_at"],
    )
    op.create_index(
        "ix_audit_logs_action_created_at",
        "audit_logs",
        ["action", "created_at"],
    )
    op.create_index(
        "ix_audit_logs_actor_user_id",
        "audit_logs",
        ["actor_user_id"],
    )
    op.create_index(
        "ix_audit_logs_target_user_id",
        "audit_logs",
        ["target_user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_audit_logs_target_user_id",
        table_name="audit_logs",
    )
    op.drop_index(
        "ix_audit_logs_actor_user_id",
        table_name="audit_logs",
    )
    op.drop_index(
        "ix_audit_logs_action_created_at",
        table_name="audit_logs",
    )
    op.drop_index(
        "ix_audit_logs_created_at",
        table_name="audit_logs",
    )
    op.drop_table("audit_logs")
