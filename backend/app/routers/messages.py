from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import classifier
from ..db import get_db
from ..evidence import log_event
from ..models import MessageCheck, User
from ..realtime import hub
from ..redact import redact
from ..security import require_role
from ..services import attached_messages, get_owned_transfer, notify_transfer

router = APIRouter(prefix="/api/messages", tags=["message checker"])
customer_only = require_role("customer")


SOURCES = Literal["sms", "whatsapp", "telegram", "email", "call", "social", "other"]


class CheckIn(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    source: SOURCES | None = None
    claimed_sender: str | None = Field(default=None, max_length=120)  # typed by the customer
    sender: str | None = Field(default=None, max_length=120)  # number or address, typed by the customer


@router.post("/check")
def check_message(body: CheckIn, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    text = body.text.strip()
    if not text:
        raise HTTPException(422, {"field": "text", "message": "Please paste a message to check."})
    result = classifier.check(text, body.source, body.sender, body.claimed_sender)
    # Only the redacted text is stored; flag spans refer to the text the customer sent and
    # are returned to them for highlighting, never persisted with raw phrases.
    stored_flags = [{"key": f["key"], "strong": f["strong"]} for f in result["flags"]]
    mc = MessageCheck(user_id=user.id, text_redacted=redact(text), flags_json=stored_flags,
                      ml_probability=result["ml_probability"] if result["ml_probability"] is not None else -1.0,
                      verdict=result["verdict"], source_channel=body.source,
                      claimed_sender=redact(body.claimed_sender.strip()) if body.claimed_sender else None,
                      scam_type=result["scam_type"], rule_pack_version=result["rule_pack_version"])
    db.add(mc)
    db.commit()
    return {"id": mc.id, **result}


@router.post("/{check_id}/report")
def report(check_id: int, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    mc = db.get(MessageCheck, check_id)
    if not mc or mc.user_id != user.id:
        raise HTTPException(404, "We couldn't find that check.")
    if not mc.reported:
        mc.reported = True
        mc.review_status = "pending"
        log_event(db, None, "customer", "message_reported", {"message_check_id": mc.id, "verdict": mc.verdict})
        db.commit()
        hub.notify({"type": "message.reported", "id": mc.id}, staff=True)
    return {"id": mc.id, "reported": True}


class FeedbackIn(BaseModel):
    helpful: bool


@router.post("/{check_id}/feedback")
def feedback(check_id: int, body: FeedbackIn, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    """"Was this helpful?" Stored for staff review; never used to retrain automatically."""
    mc = db.get(MessageCheck, check_id)
    if not mc or mc.user_id != user.id:
        raise HTTPException(404, "We couldn't find that check.")
    mc.user_feedback = "helpful" if body.helpful else "not_helpful"
    db.commit()
    return {"id": mc.id, "user_feedback": mc.user_feedback}


class AttachIn(BaseModel):
    transfer_id: int


@router.post("/{check_id}/attach")
def attach_to_payment(check_id: int, body: AttachIn, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    """Attach a checked message to one of the customer's payments as evidence for OCBC staff.

    Stored as an append-only evidence event on the case (redacted text only). Attaching also
    reports the message, so it appears under Reported messages too.
    """
    mc = db.get(MessageCheck, check_id)
    if not mc or mc.user_id != user.id:
        raise HTTPException(404, "We couldn't find that check.")
    t = get_owned_transfer(db, body.transfer_id, user)
    if any(m.id == mc.id for m in attached_messages(db, t.id)):
        raise HTTPException(409, "This message is already attached to that payment.")
    log_event(db, t.id, "customer", "message_attached", {
        "message_check_id": mc.id, "verdict": mc.verdict, "flags": [f["key"] for f in mc.flags_json or []],
        "text_redacted": mc.text_redacted,
    })
    if not mc.reported:
        mc.reported = True
        mc.review_status = "pending"
        log_event(db, None, "customer", "message_reported", {"message_check_id": mc.id, "verdict": mc.verdict})
    db.commit()
    hub.notify({"type": "message.reported", "id": mc.id}, staff=True)
    notify_transfer(db, t)
    return {"id": mc.id, "transfer_id": t.id, "attached": True}
