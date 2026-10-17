"""protect posted ladger records

Revision ID: 98b9195e1e87
Revises: 3481eb3eac54
Create Date: 2026-10-17 10:35:59.490527

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '98b9195e1e87'
down_revision = "3481eb3eac54"
# down_revision: Union[str, Sequence[str], None] = '3481eb3eac54'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None
# down_revision = "3481eb3eac54"
def upgrade() -> None:
    # Prevent edits/deletes to posted transactions.
    # Allow only a status change from posted -> reversed,
    # without changing any other transaction fields.
    op.execute("""
        CREATE FUNCTION protect_ledger_transaction()
        RETURNS TRIGGER AS $$
        BEGIN
            IF OLD.status IN ('posted', 'reversed') THEN
                IF TG_OP = 'DELETE' THEN
                    RAISE EXCEPTION
                        'Posted or reversed ledger transactions cannot be deleted';
                END IF;

                IF OLD.status = 'posted'
                   AND NEW.status = 'reversed'
                   AND NEW.id = OLD.id
                   AND NEW.reference = OLD.reference
                   AND NEW.transaction_type = OLD.transaction_type
                   AND NEW.description IS NOT DISTINCT FROM OLD.description
                   AND NEW.idempotency_key IS NOT DISTINCT FROM OLD.idempotency_key
                   AND NEW.created_at = OLD.created_at
                   AND NEW.posted_at IS NOT DISTINCT FROM OLD.posted_at
                THEN
                    RETURN NEW;
                END IF;

                RAISE EXCEPTION
                    'Posted or reversed ledger transactions cannot be modified';
            END IF;

            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_protect_ledger_transaction
        BEFORE UPDATE OR DELETE ON ledger_transactions
        FOR EACH ROW
        EXECUTE FUNCTION protect_ledger_transaction();
    """)

    # Entries can be inserted, updated or deleted only while
    # their associated transaction is still a draft.
    op.execute("""
        CREATE FUNCTION protect_ledger_entry()
        RETURNS TRIGGER AS $$
        DECLARE
            transaction_status VARCHAR(20);
        BEGIN
            IF TG_OP = 'INSERT' THEN
                SELECT status INTO transaction_status
                FROM ledger_transactions
                WHERE id = NEW.transaction_id;

                IF transaction_status IS DISTINCT FROM 'draft' THEN
                    RAISE EXCEPTION
                        'Ledger entries can only be added to draft transactions';
                END IF;

                RETURN NEW;
            END IF;

            SELECT status INTO transaction_status
            FROM ledger_transactions
            WHERE id = OLD.transaction_id;

            IF transaction_status IS DISTINCT FROM 'draft' THEN
                RAISE EXCEPTION
                    'Entries of posted or reversed transactions cannot be modified';
            END IF;

            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;

            -- If an entry is moved, its new transaction must also be a draft.
            SELECT status INTO transaction_status
            FROM ledger_transactions
            WHERE id = NEW.transaction_id;

            IF transaction_status IS DISTINCT FROM 'draft' THEN
                RAISE EXCEPTION
                    'Entries can only be moved to draft transactions';
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_protect_ledger_entry
        BEFORE INSERT OR UPDATE OR DELETE ON ledger_entries
        FOR EACH ROW
        EXECUTE FUNCTION protect_ledger_entry();
    """)


def downgrade() -> None:
    op.execute("""
        DROP TRIGGER IF EXISTS trg_protect_ledger_entry
        ON ledger_entries;
    """)
    op.execute("""
        DROP FUNCTION IF EXISTS protect_ledger_entry();
    """)
    op.execute("""
        DROP TRIGGER IF EXISTS trg_protect_ledger_transaction
        ON ledger_transactions;
    """)
    op.execute("""
        DROP FUNCTION IF EXISTS protect_ledger_transaction();
    """)