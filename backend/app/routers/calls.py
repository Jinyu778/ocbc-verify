"""Official in-app verification calls (Feature 3).

A call session is created by the customer ("Call SafeBank in-app") or by staff ("Call
customer in-app"). The session carries an HMAC signature so "Verify a call" can prove it is
genuine. Media flows browser-to-browser over WebRTC; signalling goes over the WebSocket.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..evidence import log_event, staff_actor
from ..models import CallSession, Transfer, User, utcnow
from ..realtime import hub
from ..security import get_current_user, require_role, sign_call, verify_call_signature
from ..services import as_utc, get_owned_transfer, notify_transfer

router = APIRouter(prefix="/api/calls", tags=["calls"])


class CallIn(BaseModel):
    transfer_id: int | None = None


class FallbackIn(BaseModel):
    reason: str = "webrtc_failed"


def call_out(c: CallSession) -> dict:
    return {
        "id": c.id,
        "status": c.status,
        "mode": c.mode,
        "initiated_by": c.initiated_by,
        "transfer_id": c.transfer_id,
        "customer": {"id": c.customer.id, "display_name": c.customer.display_name},
        "staff": {"id": c.staff.id, "display_name": c.staff.display_name} if c.staff else None,
        "signed_token": c.signed_token,
        "started_at": as_utc(c.started_at),
        "ended_at": as_utc(c.ended_at),
    }


def _participant(c: CallSession, user: User) -> bool:
    if user.role == "staff":
        return c.staff_user_id in (None, user.id)
    return c.customer_user_id == user.id


def _new_session(db: Session, customer_id: int, transfer_id: int | None, staff_id: int | None, by: str) -> CallSession:
    c = CallSession(customer_user_id=customer_id, staff_user_id=staff_id, transfer_id=transfer_id,
                    initiated_by=by, status="ringing", signed_token="pending", started_at=utcnow())
    db.add(c)
    db.flush()
    c.signed_token = sign_call(c.id, customer_id, as_utc(c.started_at))
    return c


@router.get("/config")
def ice_config(user: User = Depends(get_current_user)):
    s = get_settings()
    servers = [{"urls": "stun:stun.l.google.com:19302"}]
    if s.turn_url:
        servers.append({"urls": s.turn_url, "username": s.turn_username, "credential": s.turn_credential})
    return {"ice_servers": servers}


@router.post("", status_code=201)
def customer_calls(body: CallIn, user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    t = None
    if body.transfer_id is not None:
        t = get_owned_transfer(db, body.transfer_id, user)
        if t.status in ("sent", "cancelled", "approved_by_staff", "escalated"):
            raise HTTPException(409, "This payment is already finished.")
    c = _new_session(db, user.id, t.id if t else None, None, "customer")
    if t:
        t.status = "in_verification_call"
        if t.pause_shown_at is None:
            t.pause_shown_at = utcnow()
        log_event(db, t.id, "customer", "verification_call_requested", {"call_id": c.id})
    db.commit()
    hub.notify({"type": "call.incoming", "call_id": c.id, "customer_name": user.display_name,
                "transfer_id": c.transfer_id}, staff=True)
    if t:
        notify_transfer(db, t)
    return call_out(c)


def staff_starts_call(db: Session, staff: User, t: Transfer) -> CallSession:
    c = _new_session(db, t.customer_user_id, t.id, staff.id, "staff")
    if t.status not in ("sent", "cancelled", "approved_by_staff", "escalated"):
        t.status = "in_verification_call"
    log_event(db, t.id, staff_actor(staff.id), "staff_call_started", {"call_id": c.id})
    return c


@router.get("/active")
def active_call(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """'Verify a call': is SafeBank genuinely calling me right now?"""
    if user.role == "staff":
        rows = db.scalars(select(CallSession).where(CallSession.status != "ended",
                                                    or_(CallSession.staff_user_id == user.id,
                                                        CallSession.staff_user_id.is_(None)))
                          .order_by(CallSession.id.desc())).all()
        return {"calls": [call_out(c) for c in rows]}
    c = db.scalar(select(CallSession).where(CallSession.customer_user_id == user.id, CallSession.status != "ended")
                  .order_by(CallSession.id.desc()).limit(1))
    genuine = bool(c and c.staff_user_id and verify_call_signature(c.signed_token, c.id, c.customer_user_id,
                                                                    as_utc(c.started_at)))
    if c:
        log_event(db, c.transfer_id, "customer", "verify_call_checked", {"call_id": c.id, "genuine": genuine})
        db.commit()
    return {"genuine": genuine, "call": call_out(c) if c else None}


@router.get("/{call_id}")
def get_call(call_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.get(CallSession, call_id)
    if not c or not _participant(c, user):
        raise HTTPException(404, "Call not found.")
    return call_out(c)


@router.post("/{call_id}/accept")
def accept(call_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.get(CallSession, call_id)
    if not c or not _participant(c, user) or c.status == "ended":
        raise HTTPException(404, "This call has ended.")
    if user.role == "staff":
        if c.initiated_by != "customer":
            raise HTTPException(409, "Only the customer can accept this call.")
        c.staff_user_id = user.id
    elif c.initiated_by != "staff":
        raise HTTPException(409, "Waiting for SafeBank to answer.")
    c.status = "active"
    actor = staff_actor(user.id) if user.role == "staff" else "customer"
    log_event(db, c.transfer_id, actor, "call_connected", {"call_id": c.id})
    db.commit()
    db.refresh(c)
    msg = {"type": "call.accepted", "call": call_out(c)}
    hub.notify(msg, user_ids=[c.customer_user_id, c.staff_user_id])
    hub.notify({"type": "call.updated", "call_id": c.id}, staff=True)
    return call_out(c)


@router.post("/{call_id}/fallback")
def fallback(call_id: int, body: FallbackIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.get(CallSession, call_id)
    if not c or not _participant(c, user):
        raise HTTPException(404, "Call not found.")
    c.mode = "text"
    actor = staff_actor(user.id) if user.role == "staff" else "customer"
    log_event(db, c.transfer_id, actor, "call_fallback_text_chat", {"call_id": c.id, "reason": body.reason[:80]})
    db.commit()
    hub.notify({"type": "call.fallback", "call_id": c.id}, user_ids=[c.customer_user_id, c.staff_user_id])
    return call_out(c)


@router.post("/{call_id}/end")
def end(call_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.get(CallSession, call_id)
    if not c or not _participant(c, user):
        raise HTTPException(404, "Call not found.")
    if c.status != "ended":
        c.status = "ended"
        c.ended_at = utcnow()
        actor = staff_actor(user.id) if user.role == "staff" else "customer"
        log_event(db, c.transfer_id, actor, "call_ended",
                  {"call_id": c.id, "seconds": int((c.ended_at - as_utc(c.started_at)).total_seconds())})
        db.commit()
    hub.notify({"type": "call.ended", "call_id": c.id}, user_ids=[c.customer_user_id, c.staff_user_id], staff=True)
    return call_out(c)
