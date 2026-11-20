from datetime import timedelta
from decimal import Decimal, InvalidOperation
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..evidence import log_event
from ..models import Account, Payee, Transfer, User, utcnow
from ..realtime import hub
from ..risk_engine import QUESTION_KEYS, Signals, assess
from ..security import require_role
from ..services import (
    active_trusted_contact,
    amount_band,
    as_utc,
    continue_ready_at,
    get_owned_transfer,
    move_money,
    needs_hang_up,
    notify_transfer,
    payee_is_new,
    payee_report_count,
    require_not_done,
    transfer_out,
)

router = APIRouter(prefix="/api/transfers", tags=["transfers"])
customer_only = require_role("customer")


class SignalsIn(BaseModel):
    on_call: bool = False
    recent_call: bool = False
    chatting: bool = False
    screen_sharing: bool = False
    available: bool = True
    # native = Android call-state plugin; customer_answer = the customer's own answer in the
    # browser; not_asked = browser, known payee (no question shown); none = permission denied/failed
    source: Literal["native", "customer_answer", "not_asked", "none"] = "not_asked"


class CreateIn(BaseModel):
    payee_id: int
    amount: str = Field(description="Decimal string, SGD")
    signals: SignalsIn = SignalsIn()


class AnswersIn(BaseModel):
    q_phone: bool
    q_secret: bool
    q_online: bool
    q_chat: bool


class SaveIn(BaseModel):
    minutes: int


class CallStateIn(BaseModel):
    on_call: bool
    # native = the Android call-state plugin; customer_answer = the customer tapped "I've hung up"
    source: Literal["native", "customer_answer"]


class CallBackIn(BaseModel):
    # Which number from the app's built-in official directory the customer chose to call back.
    target: Literal["ocbc_hotline", "scamshield", "police"]


def _duration(seconds: int) -> str:
    """60 -> "1 minute", 600 -> "10 minutes", 45 -> "45 seconds"."""
    if seconds % 60:
        return f"{seconds} seconds"
    m = seconds // 60
    return f"{m} minute" if m == 1 else f"{m} minutes"


def field_error(field: str, message: str):
    raise HTTPException(422, {"field": field, "message": message})


def parse_amount(raw: str) -> Decimal:
    try:
        amt = Decimal(str(raw).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        field_error("amount", "Please enter an amount in numbers, for example 120.50.")
    if not amt.is_finite():
        field_error("amount", "Please enter an amount in numbers, for example 120.50.")
    if amt <= 0:
        field_error("amount", "The amount must be more than S$0.")
    if amt.as_tuple().exponent < -2:
        field_error("amount", "Please use at most 2 decimal places, for example 120.50.")
    return amt.quantize(Decimal("0.01"))


def _score(db: Session, t: Transfer, answers: dict | None):
    acct = db.scalar(select(Account).where(Account.user_id == t.customer_user_id))
    return assess(
        amount=t.amount,
        is_new_payee=payee_is_new(db, t.payee),
        signals=Signals.from_dict(t.signals_json),
        history_mean=acct.typical_transfer_mean,
        history_std=acct.typical_transfer_std,
        answers=answers,
        payee_reported_by_others=payee_report_count(db, t.payee, t.customer_user_id),
    )


def _apply(t: Transfer, result) -> None:
    t.risk_score = result.score
    t.risk_tier = result.tier
    t.reasons_json = result.reasons_dicts()


@router.post("", status_code=201)
def create_transfer(body: CreateIn, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    amount = parse_amount(body.amount)
    payee = db.get(Payee, body.payee_id)
    if not payee or payee.owner_user_id != user.id:
        field_error("payee_id", "We couldn't find this payee. Please choose one from your list.")
    acct = db.scalar(select(Account).where(Account.user_id == user.id))
    if amount > acct.balance:
        field_error("amount", f"This is more than your balance of S${acct.balance:,.2f}. Please enter a smaller amount.")

    sig = body.signals.model_dump()
    t = Transfer(customer_user_id=user.id, payee_id=payee.id, amount=amount, status="checking", signals_json=sig)
    if body.signals.recent_call and not body.signals.on_call:
        t.call_ended_at = utcnow()  # the call is already over; the cooling-off time counts from now
    t.payee = payee
    db.add(t)
    db.flush()
    result = _score(db, t, None)
    _apply(t, result)
    log_event(db, t.id, "customer", "transfer_created", {"amount": str(amount), "payee": payee.name})
    log_event(db, t.id, "system", "signal_source", {"source": body.signals.source})
    if not body.signals.available:
        log_event(db, t.id, "system", "signal_unavailable", {"source": body.signals.source})
    log_event(db, t.id, "system", "risk_scored", {"score": result.score, "tier": result.tier,
                                                  "reasons": [r.key for r in result.reasons],
                                                  "override": result.override, "signals": sig,
                                                  "z_score": result.z_score})
    db.commit()
    if t.risk_tier != "none":
        notify_transfer(db, t)
    return transfer_out(db, t)


@router.get("/{transfer_id}")
def get_transfer(transfer_id: int, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    return transfer_out(db, get_owned_transfer(db, transfer_id, user))


@router.post("/{transfer_id}/answers")
def submit_answers(transfer_id: int, body: AnswersIn, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    t = get_owned_transfer(db, transfer_id, user)
    if t.status != "checking":
        raise HTTPException(409, "These questions have already been answered.")
    answers = body.model_dump()
    t.answers_json = answers
    result = _score(db, t, answers)
    _apply(t, result)
    log_event(db, t.id, "customer", "questions_answered", answers)
    log_event(db, t.id, "system", "risk_rescored", {"score": result.score, "tier": result.tier,
                                                    "reasons": [r.key for r in result.reasons],
                                                    "override": result.override})
    if result.tier == "pause":
        t.status = "paused"
        t.pause_shown_at = utcnow()
        log_event(db, t.id, "system", "pause_shown", {})
    db.commit()
    notify_transfer(db, t)
    return transfer_out(db, t)


@router.post("/{transfer_id}/send")
def send(transfer_id: int, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    t = get_owned_transfer(db, transfer_id, user)
    now = utcnow()
    allowed = False
    why = ""
    if t.status == "checking":
        if t.risk_tier == "none":
            allowed, why = True, "no_risk"
        elif t.risk_tier == "ask" and t.answers_json is not None:
            allowed, why = True, "answered_questions"
        else:
            raise HTTPException(409, "Please answer the safety questions first.")
    elif t.status == "saved_for_later":
        if t.wait_until and now >= as_utc(t.wait_until):
            allowed, why = True, "waited"
        else:
            raise HTTPException(409, "The waiting time is not over yet. You can send this when the timer ends.")
    elif t.status == "waiting_trusted_contact":
        if t.trusted_decision == "ok":
            allowed, why = True, "trusted_contact_ok"
        else:
            raise HTTPException(409, "Your trusted contact has not said OK yet.")
    elif t.status == "paused":
        raise HTTPException(409, "This payment is paused. Choose one of the options on the screen.")
    else:
        require_not_done(t)
        raise HTTPException(409, "This payment can't be sent right now.")
    if allowed:
        move_money(db, t, "sent", "customer")
        log_event(db, t.id, "customer", "sent", {"route": why})
    db.commit()
    notify_transfer(db, t)
    return transfer_out(db, t)


@router.post("/{transfer_id}/continue-anyway")
def continue_anyway(transfer_id: int, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    t = get_owned_transfer(db, transfer_id, user)
    if t.status not in ("paused", "waiting_trusted_contact") or t.trusted_decision == "stop":
        require_not_done(t)
        raise HTTPException(409, "This option isn't available for this payment.")
    s = get_settings()
    shown = as_utc(t.pause_shown_at)
    hang_up = needs_hang_up(t)
    if hang_up and t.call_ended_at is None:
        log_event(db, t.id, "customer", "continue_anyway_rejected_on_call", {})
        db.commit()
        raise HTTPException(409, "Please hang up first. Scammers keep you on the line so you can't stop and check. "
                                 f"You can continue {_duration(s.hang_up_wait_minutes * 60)} after the call ends.")
    ready = continue_ready_at(t)
    if ready is None or utcnow() < ready:
        log_event(db, t.id, "customer", "continue_anyway_rejected_too_early", {})
        db.commit()
        if hang_up:
            raise HTTPException(409, f"Please wait {_duration(s.hang_up_wait_minutes * 60)} after the call before continuing.")
        raise HTTPException(409, f"Please take {_duration(s.continue_anyway_seconds)} to read the warning before continuing.")
    log_event(db, t.id, "customer", "continue_anyway", {"seconds_after_pause": int((utcnow() - shown).total_seconds()),
                                                        "after_phone_call": hang_up})
    move_money(db, t, "sent", "customer")
    db.commit()
    notify_transfer(db, t)
    # The customer overrode a warning: tell staff so someone can follow up quickly.
    hub.notify({"type": "case.continued_anyway", "transfer_id": t.id, "customer_name": user.display_name,
                "amount": str(t.amount), "after_phone_call": hang_up}, staff=True)
    return transfer_out(db, t)


@router.post("/{transfer_id}/call-state")
def call_state(transfer_id: int, body: CallStateIn, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    """The phone call behind a paused payment ended (or a call started again).

    On Android the call-state plugin reports this by itself; in a browser the customer taps
    "I've hung up". A new call after that resets the wait, because scammers often call back.
    """
    t = get_owned_transfer(db, transfer_id, user)
    if t.status not in ("paused", "waiting_trusted_contact"):
        raise HTTPException(409, "This payment isn't waiting on a phone call.")
    if needs_hang_up(t):
        if body.on_call and t.call_ended_at is not None:
            t.call_ended_at = None
            log_event(db, t.id, "system" if body.source == "native" else "customer", "call_resumed", {"source": body.source})
        elif not body.on_call and t.call_ended_at is None:
            t.call_ended_at = utcnow()
            log_event(db, t.id, "system" if body.source == "native" else "customer", "call_ended_reported",
                      {"source": body.source})
        db.commit()
        notify_transfer(db, t)
    return transfer_out(db, t)


@router.post("/{transfer_id}/call-back")
def call_back(transfer_id: int, body: CallBackIn, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    """Evidence only: the customer chose to call back on a number from the app's official directory."""
    t = get_owned_transfer(db, transfer_id, user)
    log_event(db, t.id, "customer", "official_callback_chosen", {"target": body.target})
    db.commit()
    notify_transfer(db, t)
    return transfer_out(db, t)


@router.post("/{transfer_id}/save")
def save_for_later(transfer_id: int, body: SaveIn, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    t = get_owned_transfer(db, transfer_id, user)
    require_not_done(t)
    if t.status == "waiting_trusted_contact" and t.trusted_decision == "stop":
        raise HTTPException(409, "Your trusted contact asked to stop this payment. OCBC will review it with you.")
    if t.status == "checking" and t.risk_tier != "none" and t.answers_json is None:
        raise HTTPException(409, "Please answer the safety questions first.")
    options = get_settings().save_options
    if body.minutes not in options:
        field_error("minutes", "Please choose one of the waiting times shown.")
    t.status = "saved_for_later"
    t.wait_until = utcnow() + timedelta(minutes=body.minutes)
    log_event(db, t.id, "customer", "saved_for_later", {"minutes": body.minutes, "wait_until": str(t.wait_until)})
    db.commit()
    notify_transfer(db, t)
    return transfer_out(db, t)


@router.post("/{transfer_id}/cancel")
def cancel(transfer_id: int, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    t = get_owned_transfer(db, transfer_id, user)
    if t.status in ("sent", "cancelled", "approved_by_staff", "escalated"):
        raise HTTPException(409, "This payment can't be cancelled now.")
    previous = t.status
    t.status = "cancelled"
    t.completed_at = utcnow()
    log_event(db, t.id, "customer", "cancelled", {"from_status": previous})
    db.commit()
    notify_transfer(db, t)
    return transfer_out(db, t)


@router.post("/{transfer_id}/ask-trusted")
def ask_trusted(transfer_id: int, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    t = get_owned_transfer(db, transfer_id, user)
    require_not_done(t)
    if t.status not in ("paused", "checking", "saved_for_later"):
        raise HTTPException(409, "You can't ask your trusted contact about this payment now.")
    tc = active_trusted_contact(db, user.id)
    if not tc:
        raise HTTPException(409, "You don't have a trusted contact yet. You can add one in Settings.")
    t.status = "waiting_trusted_contact"
    t.trusted_requested_at = utcnow()
    t.trusted_decision = None
    if t.pause_shown_at is None:
        t.pause_shown_at = utcnow()
    log_event(db, t.id, "customer", "trusted_contact_asked", {"contact_id": tc.contact_user_id})
    db.commit()
    hub.notify({"type": "trusted.request", "transfer_id": t.id, "customer_name": user.display_name,
                "amount_band": amount_band(t.amount)}, user_ids=[tc.contact_user_id])
    notify_transfer(db, t)
    return transfer_out(db, t)
