"""Trusted-contact view. Shows ONLY: customer name, amount band, payee type, reasons summary.
Never the balance, account numbers or payee account details."""

from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..evidence import log_event
from ..models import Transfer, TrustedContact, User, utcnow
from ..security import require_role
from ..services import active_trusted_contact, amount_band, as_utc, notify_transfer
from ..codeword import hash_code_word

router = APIRouter(prefix="/api/trusted", tags=["trusted contact"])
contact_only = require_role("trusted_contact")


class DecisionIn(BaseModel):
    decision: Literal["ok", "stop"]


def _customers_for(db: Session, contact: User) -> list[int]:
    rows = db.scalars(select(TrustedContact).where(TrustedContact.contact_user_id == contact.id)).all()
    ids = []
    for r in rows:
        tc = active_trusted_contact(db, r.customer_user_id)
        if tc and tc.contact_user_id == contact.id:
            ids.append(r.customer_user_id)
    return ids


def request_view(t: Transfer) -> dict:
    s = get_settings()
    reasons = [r["key"] for r in (t.reasons_json or []) if r.get("points", 0) > 0 or r["key"].startswith("override")]
    new_payee = any(r == "new_payee" for r in reasons)
    requested = as_utc(t.trusted_requested_at)
    return {
        "transfer_id": t.id,
        "customer_name": t.customer.display_name,
        "amount_band": amount_band(t.amount),
        "payee_type": "new" if new_payee else "known",
        "reason_keys": reasons,
        "requested_at": requested,
        "timeout_at": requested + timedelta(minutes=s.trusted_contact_timeout_minutes) if requested else None,
        "decision": t.trusted_decision,
        "decided_at": as_utc(t.trusted_decided_at),
        "status": t.status if t.status in ("waiting_trusted_contact",) else "closed",
    }


@router.get("/requests")
def list_requests(user: User = Depends(contact_only), db: Session = Depends(get_db)):
    cust_ids = _customers_for(db, user)
    if not cust_ids:
        return {"pending": [], "history": []}
    rows = db.scalars(
        select(Transfer).where(Transfer.customer_user_id.in_(cust_ids), Transfer.trusted_requested_at.is_not(None))
        .order_by(Transfer.trusted_requested_at.desc()).limit(50)
    ).all()
    pending = [request_view(t) for t in rows if t.status == "waiting_trusted_contact" and t.trusted_decision is None]
    history = [request_view(t) for t in rows if not (t.status == "waiting_trusted_contact" and t.trusted_decision is None)]
    return {"pending": pending, "history": history}


@router.post("/requests/{transfer_id}/decision")
def decide(transfer_id: int, body: DecisionIn, user: User = Depends(contact_only), db: Session = Depends(get_db)):
    t = db.get(Transfer, transfer_id)
    if not t or t.customer_user_id not in _customers_for(db, user):
        raise HTTPException(404, "We couldn't find this request.")
    if t.status != "waiting_trusted_contact" or t.trusted_decision is not None:
        raise HTTPException(409, "This request has already been answered or closed.")
    t.trusted_decision = body.decision
    t.trusted_decided_at = utcnow()
    if body.decision == "stop":
        # Not a permanent block: SafeBank staff review it with the customer.
        t.status = "under_staff_review"
    log_event(db, t.id, "trusted_contact", f"trusted_contact_{body.decision}",
              {"contact_id": user.id, "seconds_to_respond":
               int((t.trusted_decided_at - as_utc(t.trusted_requested_at)).total_seconds())})
    db.commit()
    notify_transfer(db, t, extra_users=[user.id])
    return request_view(t)


# --- family code word, set by the trusted contact for the customer they look after -------------
class CodeWordIn(BaseModel):
    code_word: str


@router.get("/customers")
def my_customers(user: User = Depends(contact_only), db: Session = Depends(get_db)):
    out = []
    for cid in _customers_for(db, user):
        c = db.get(User, cid)
        out.append({"id": c.id, "display_name": c.display_name, "code_word_is_set": bool(c.family_code_word_hash)})
    return out


@router.put("/customers/{customer_id}/code-word")
def set_customer_code_word(customer_id: int, body: CodeWordIn, user: User = Depends(contact_only),
                           db: Session = Depends(get_db)):
    if customer_id not in _customers_for(db, user):
        raise HTTPException(404, "You are not the trusted contact for this customer.")
    c = db.get(User, customer_id)
    c.family_code_word_hash = hash_code_word(body.code_word)
    log_event(db, None, "trusted_contact", "family_code_word_set", {"customer_id": c.id, "set_by": "trusted_contact"})
    db.commit()
    return {"id": c.id, "code_word_is_set": True}
