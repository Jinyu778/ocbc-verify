from sqlalchemy.orm import Session

from .models import EvidenceEvent


def log_event(db: Session, transfer_id: int | None, actor: str, event_type: str, detail: dict | None = None) -> EvidenceEvent:
    """Append an evidence event. There is deliberately no update or delete helper."""
    ev = EvidenceEvent(transfer_id=transfer_id, actor=actor, event_type=event_type, detail_json=detail or {})
    db.add(ev)
    return ev


def staff_actor(user_id: int) -> str:
    return f"staff:{user_id}"
