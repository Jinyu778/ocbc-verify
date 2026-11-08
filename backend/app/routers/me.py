import re
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..evidence import log_event
from ..models import Account, Payee, Transfer, TrustedContact, User, utcnow
from ..security import get_current_user, require_role
from ..services import active_trusted_contact, as_utc, payee_is_new, transfer_out
from .auth import user_out

router = APIRouter(prefix="/api/me", tags=["me"])
customer_only = require_role("customer")


class PrefsIn(BaseModel):
    preferred_language: Literal["en", "zh", "ms", "ta"] | None = None
    easy_mode: bool | None = None


@router.patch("/preferences")
def update_prefs(body: PrefsIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.preferred_language is not None:
        user.preferred_language = body.preferred_language
    if body.easy_mode is not None:
        user.easy_mode = body.easy_mode
    db.add(user)
    db.commit()
    return user_out(user)


@router.get("/account")
def account(user: User = Depends(customer_only), db: Session = Depends(get_db)):
    acct = db.scalar(select(Account).where(Account.user_id == user.id))
    return {"balance": str(acct.balance), "typical_transfer_mean": str(acct.typical_transfer_mean)}


@router.get("/payees")
def payees(user: User = Depends(customer_only), db: Session = Depends(get_db)):
    rows = db.scalars(select(Payee).where(Payee.owner_user_id == user.id).order_by(Payee.id)).all()
    out = [{"id": p.id, "name": p.name, "account_ref": p.account_ref, "is_new": payee_is_new(db, p)} for p in rows]
    out.sort(key=lambda p: p["is_new"])
    return out


class PayeeIn(BaseModel):
    name: str
    account_ref: str


@router.post("/payees", status_code=201)
def add_payee(body: PayeeIn, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    name = " ".join(body.name.split())
    ref = re.sub(r"[\s-]", "", body.account_ref).upper()
    if not 2 <= len(name) <= 60:
        raise HTTPException(422, {"field": "name", "message": "Please enter a name between 2 and 60 characters."})
    if not re.fullmatch(r"[A-Z0-9]{6,20}", ref):
        raise HTTPException(422, {"field": "account_ref",
                                  "message": "Please enter an account number of 6 to 20 letters or digits."})
    exists = db.scalar(select(Payee).where(Payee.owner_user_id == user.id, Payee.account_ref == ref))
    if exists:
        raise HTTPException(422, {"field": "account_ref", "message": f"You already have this account saved as '{exists.name}'."})
    p = Payee(owner_user_id=user.id, name=name, account_ref=ref)
    db.add(p)
    log_event(db, None, "customer", "payee_added", {"customer_id": user.id, "payee_name": name})
    db.commit()
    db.refresh(p)
    return {"id": p.id, "name": p.name, "account_ref": p.account_ref, "is_new": True}


@router.get("/activity")
def activity(user: User = Depends(customer_only), db: Session = Depends(get_db), limit: int = 20):
    rows = db.scalars(
        select(Transfer).where(Transfer.customer_user_id == user.id)
        .order_by(Transfer.created_at.desc()).limit(min(limit, 100))
    ).all()
    return [transfer_out(db, t) for t in rows]


# --- trusted contact management -------------------------------------------------------------
RELATIONSHIPS = ("parent", "child", "sibling", "spouse", "friend", "other")


class TrustedIn(BaseModel):
    contact_username: str
    relationship: Literal["parent", "child", "sibling", "spouse", "friend", "other"]


def _tc_out(tc: TrustedContact, now) -> dict:
    return {
        "id": tc.id,
        "contact_display_name": tc.contact.display_name,
        "contact_username": tc.contact.username,
        "relationship": tc.relationship_type,
        "active_from": as_utc(tc.active_from),
        "pending_removal_at": as_utc(tc.pending_removal_at),
        "is_active": as_utc(tc.active_from) <= now and (tc.pending_removal_at is None or as_utc(tc.pending_removal_at) > now),
    }


@router.get("/trusted-contacts")
def list_trusted(user: User = Depends(customer_only), db: Session = Depends(get_db)):
    now = utcnow()
    rows = db.scalars(select(TrustedContact).where(TrustedContact.customer_user_id == user.id)).all()
    rows = [r for r in rows if r.pending_removal_at is None or as_utc(r.pending_removal_at) > now]
    return {"contacts": [_tc_out(r, now) for r in rows], "change_delay_minutes": get_settings().contact_change_cooling_minutes}


@router.post("/trusted-contacts")
def add_trusted(body: TrustedIn, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    contact = db.scalar(select(User).where(User.username == body.contact_username.strip().lower()))
    if not contact or contact.role != "trusted_contact" or contact.id == user.id:
        raise HTTPException(422, "We couldn't find a SafeBank user with that username. Ask them for their username.")
    now = utcnow()
    current = active_trusted_contact(db, user.id, now)
    # First contact is immediate. Changing an existing contact waits 24 h, so a scammer who
    # has taken over the phone can't quietly swap in their own "trusted contact".
    delay = timedelta(minutes=get_settings().contact_change_cooling_minutes) if current else timedelta(0)
    if current:
        if current.contact_user_id == contact.id:
            raise HTTPException(422, "This person is already your trusted contact.")
        current.pending_removal_at = now + delay
    tc = TrustedContact(customer_user_id=user.id, contact_user_id=contact.id,
                        relationship_type=body.relationship, active_from=now + delay)
    db.add(tc)
    log_event(db, None, "customer", "trusted_contact_change_requested",
              {"customer_id": user.id, "new_contact_id": contact.id, "takes_effect": str(now + delay)})
    db.commit()
    db.refresh(tc)
    return _tc_out(tc, now)


@router.delete("/trusted-contacts/{tc_id}")
def remove_trusted(tc_id: int, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    tc = db.get(TrustedContact, tc_id)
    if not tc or tc.customer_user_id != user.id:
        raise HTTPException(404, "Trusted contact not found.")
    now = utcnow()
    tc.pending_removal_at = now + timedelta(minutes=get_settings().contact_change_cooling_minutes)
    log_event(db, None, "customer", "trusted_contact_removal_requested",
              {"customer_id": user.id, "contact_id": tc.contact_user_id, "takes_effect": str(tc.pending_removal_at)})
    db.commit()
    return _tc_out(tc, now)
