
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def record_admin_action(
    db: Session,
    *,
    actor_user_id: int,
    action: str,
    target_user_id: int | None = None,
    wallet_id: int | None = None,
    details: dict[str, Any] | None = None,
    commit: bool = True,
) -> AuditLog:
    entry = AuditLog(
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
        wallet_id=wallet_id,
        action=action,
        details=details or {},
    )

    db.add(entry)
    db.flush()

    if commit:
        db.commit()
        db.refresh(entry)

    return entry
