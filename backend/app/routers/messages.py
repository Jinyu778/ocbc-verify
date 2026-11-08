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

router = APIRouter(prefix="/api/messages", tags=["message checker"])
customer_only = require_role("customer")


class CheckIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


@router.post("/check")
def check_message(body: CheckIn, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    text = body.text.strip()
    if not text:
        raise HTTPException(422, {"field": "text", "message": "Please paste a message to check."})
    result = classifier.check(text)
    # Only the redacted text is stored; flag spans refer to the text the customer sent and
    # are returned to them for highlighting, never persisted with raw phrases.
    stored_flags = [{"key": f["key"], "strong": f["strong"]} for f in result["flags"]]
    mc = MessageCheck(user_id=user.id, text_redacted=redact(text), flags_json=stored_flags,
                      ml_probability=result["ml_probability"], verdict=result["verdict"])
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
