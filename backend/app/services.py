from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .evidence import log_event
from .friction import continue_anyway_at, hang_up_required
from .models import FINAL_STATUSES, Account, CallSession, EvidenceEvent, MessageCheck, Payee, Transfer, TrustedContact, User, utcnow
from .realtime import hub
from .risk_engine import Signals

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


def normalize_account(ref: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", ref.upper())


def payee_report_count(db: Session, payee: Payee, customer_id: int) -> int:
    """How many OTHER customers reported this payee account.

    A report is an existing case on the same account number that staff escalated to the
    Anti-Scam Centre, or that the customer attached a checked (reported) message to.
    """
    norm = normalize_account(payee.account_ref)
    same = [p.id for p in db.scalars(select(Payee).where(Payee.owner_user_id != customer_id)).all()
            if normalize_account(p.account_ref) == norm]
    if not same:
        return 0
    ts = db.scalars(select(Transfer).where(Transfer.payee_id.in_(same), Transfer.is_seed_history.is_(False))).all()
    if not ts:
        return 0
    with_msg = set(db.scalars(select(EvidenceEvent.transfer_id).where(
        EvidenceEvent.transfer_id.in_([t.id for t in ts]), EvidenceEvent.event_type == "message_attached")).all())
    return len({t.customer_user_id for t in ts if t.status == "escalated" or t.id in with_msg})


def attached_messages(db: Session, transfer_id: int) -> list[MessageCheck]:
    ids = [e.detail_json.get("message_check_id") for e in db.scalars(select(EvidenceEvent).where(
        EvidenceEvent.transfer_id == transfer_id, EvidenceEvent.event_type == "message_attached")).all()]
    return [m for m in (db.get(MessageCheck, i) for i in ids if i) if m]


def code_word_prompt(db: Session, t: Transfer) -> bool:
    """Prompt for the family code word on a live call, or when a 'family emergency' message is attached."""
    sig = t.signals_json or {}
    answers = t.answers_json or {}
    if sig.get("on_call") or sig.get("recent_call") or answers.get("q_phone"):
        return True
    return any(any(f.get("key") == "family_new_number" for f in (m.flags_json or [])) for m in attached_messages(db, t.id))


def needs_hang_up(t: Transfer) -> bool:
    """A phone call is part of this payment, so the customer must hang up before "Continue anyway"."""
    return hang_up_required(Signals.from_dict(t.signals_json), t.answers_json)


def continue_ready_at(t: Transfer) -> datetime | None:
    s = get_settings()
    return continue_anyway_at(
        pause_shown_at=as_utc(t.pause_shown_at),
        read_seconds=s.continue_anyway_seconds,
        hang_up_needed=needs_hang_up(t),
        call_ended_at=as_utc(t.call_ended_at),
        hang_up_wait_minutes=s.hang_up_wait_minutes,
    )


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
        "continue_anyway_at": continue_ready_at(t),
        "hang_up_required": needs_hang_up(t),
        "call_ended_at": as_utc(t.call_ended_at),
        "trusted_requested_at": trusted_at,
        "trusted_timeout_at": trusted_at + timedelta(minutes=s.trusted_contact_timeout_minutes) if trusted_at else None,
        "trusted_decision": t.trusted_decision,
        "trusted_contact_name": tc.contact.display_name if tc else None,
        "active_call_id": call.id if call else None,
        "false_positive": t.false_positive,
        "payee_reported": any(r.get("key") == "payee_reported" for r in (t.reasons_json or [])),
        "code_word_prompt": code_word_prompt(db, t),
        "code_word_set": bool(t.customer.family_code_word_hash),
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
