from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .evidence import log_event
from .models import FINAL_STATUSES, Account, CallSession, Payee, Transfer, TrustedContact, User, utcnow
from .realtime import hub

DONE_STATUSES = FINAL_STATUSES | {"under_staff_review"}


def as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def payee_is_new(db: Session, payee: Payee) -> bool:
    paid = db.scalar(
        select(Transfer.id).where(
            Transfer.payee_id == payee.id, Transfer.status.in_(("sent", "approved_by_staff"))
        ).limit(1)
    )
    return paid is None


def active_trusted_contact(db: Session, customer_id: int, now: datetime | None = None) -> TrustedContact | None:
    now = now or utcnow()
    rows = db.scalars(select(TrustedContact).where(TrustedContact.customer_user_id == customer_id)).all()
    for tc in sorted(rows, key=lambda r: as_utc(r.active_from), reverse=True):
        if as_utc(tc.active_from) <= now and (tc.pending_removal_at is None or as_utc(tc.pending_removal_at) > now):
            return tc
    return None


def next_step(t: Transfer) -> str:
    if t.status == "checking":
        if t.risk_tier == "none":
            return "confirm"
        if t.answers_json is None:
            return "questions"
        return "confirm"
    return {
        "paused": "pause",
        "saved_for_later": "saved",
        "waiting_trusted_contact": "trusted",
        "in_verification_call": "call",
    }.get(t.status, "done")


def amount_band(amount: Decimal) -> str:
    bands = [(100, "under S$100"), (1000, "S$100 – S$1,000"), (5000, "S$1,000 – S$5,000"),
             (10000, "S$5,000 – S$10,000"), (50000, "S$10,000 – S$50,000")]
    for limit, label in bands:
        if amount < limit:
            return label
    return "over S$50,000"


def transfer_out(db: Session, t: Transfer) -> dict:
    s = get_settings()
    pause_at = as_utc(t.pause_shown_at)
    trusted_at = as_utc(t.trusted_requested_at)
    call = db.scalar(
        select(CallSession).where(CallSession.transfer_id == t.id, CallSession.status != "ended")
        .order_by(CallSession.id.desc()).limit(1)
    )
    tc = active_trusted_contact(db, t.customer_user_id)
    return {
        "id": t.id,
        "payee": {"id": t.payee.id, "name": t.payee.name, "is_new": payee_is_new(db, t.payee)
                  if t.status not in ("sent", "approved_by_staff") else False},
        "amount": str(t.amount),
        "status": t.status,
        "risk_score": t.risk_score,
        "risk_tier": t.risk_tier,
        "reasons": t.reasons_json or [],
        "signals": t.signals_json or {},
        "answers": t.answers_json,
        "wait_until": as_utc(t.wait_until),
        "pause_shown_at": pause_at,
        "continue_anyway_at": pause_at + timedelta(seconds=s.continue_anyway_seconds) if pause_at else None,
        "trusted_requested_at": trusted_at,
        "trusted_timeout_at": trusted_at + timedelta(seconds=s.trusted_timeout_seconds) if trusted_at else None,
        "trusted_decision": t.trusted_decision,
        "trusted_contact_name": tc.contact.display_name if tc else None,
        "active_call_id": call.id if call else None,
        "false_positive": t.false_positive,
        "next_step": next_step(t),
        "created_at": as_utc(t.created_at),
        "updated_at": as_utc(t.updated_at),
        "completed_at": as_utc(t.completed_at),
    }


def notify_transfer(db: Session, t: Transfer, extra_users: list[int] | None = None) -> None:
    users = [t.customer_user_id] + (extra_users or [])
    tc = active_trusted_contact(db, t.customer_user_id)
    if tc and t.trusted_requested_at:
        users.append(tc.contact_user_id)
    hub.notify({"type": "transfer.updated", "transfer_id": t.id, "status": t.status}, user_ids=users, staff=True)


def move_money(db: Session, t: Transfer, final_status: str, actor: str) -> None:
    """The only place balances change. Runs inside the caller's DB transaction."""
    if final_status not in ("sent", "approved_by_staff"):
        raise ValueError("money only moves on sent / approved_by_staff")
    acct = db.scalar(select(Account).where(Account.user_id == t.customer_user_id).with_for_update())
    if acct is None:
        raise HTTPException(409, "No account found for this customer.")
    if acct.balance < t.amount:
        raise HTTPException(409, "There is not enough money in the account for this payment. Nothing was sent.")
    acct.balance = (acct.balance - t.amount).quantize(Decimal("0.01"))
    t.status = final_status
    t.completed_at = utcnow()
    log_event(db, t.id, actor, "money_moved", {"amount": str(t.amount), "new_balance": str(acct.balance),
                                               "status": final_status})


def get_owned_transfer(db: Session, transfer_id: int, user: User) -> Transfer:
    t = db.get(Transfer, transfer_id)
    if not t or t.customer_user_id != user.id or t.is_seed_history:
        raise HTTPException(404, "We couldn't find that payment.")
    return t


def require_not_done(t: Transfer) -> None:
    if t.status in DONE_STATUSES:
        raise HTTPException(409, f"This payment is already {t.status.replace('_', ' ')}.")
