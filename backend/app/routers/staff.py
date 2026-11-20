import html
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..evidence import log_event, staff_actor
from ..models import HELD_STATUSES, Account, CallSession, EvidenceEvent, MessageCheck, StaffAction, Transfer, User, utcnow
from ..realtime import hub
from ..security import require_role
from ..services import as_utc, attached_messages, move_money, notify_transfer, transfer_out
from .calls import call_out, staff_starts_call

router = APIRouter(prefix="/api/staff", tags=["staff"])
staff_only = require_role("staff")
TIER_ORDER = {"pause": 0, "ask": 1, "none": 2}
CLOSED = ("sent", "cancelled", "approved_by_staff")


class ActionIn(BaseModel):
    action: Literal["approve", "call", "escalate", "genuine"]
    note: str = Field(min_length=3, max_length=1000)


class ReviewIn(BaseModel):
    review_status: Literal["reviewed", "escalated"]
    note: str = Field(min_length=3, max_length=1000)


def _cases_query():
    return select(Transfer).where(Transfer.is_seed_history.is_(False), Transfer.risk_tier != "none")


def case_row(db: Session, t: Transfer) -> dict:
    base = transfer_out(db, t)
    now = utcnow()
    waiting = (as_utc(t.completed_at) or now) - as_utc(t.created_at)
    continued = db.scalar(select(EvidenceEvent.id).where(EvidenceEvent.transfer_id == t.id,
                                                         EvidenceEvent.event_type == "continue_anyway").limit(1))
    return {**base, "customer": {"id": t.customer.id, "display_name": t.customer.display_name, "age": t.customer.age},
            "waiting_seconds": int(waiting.total_seconds()),
            "is_new_payee": any(r["key"] == "new_payee" for r in t.reasons_json or []),
            "continued_anyway": continued is not None}


@router.get("/summary")
def summary(user: User = Depends(staff_only), db: Session = Depends(get_db)):
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    rows = db.scalars(_cases_query().where(Transfer.created_at >= start)).all()
    protected = sum((t.amount for t in rows if t.status == "cancelled" or t.status in HELD_STATUSES), Decimal("0"))
    return {
        "cases_today": len(rows),
        "paused": sum(1 for t in rows if t.status == "paused"),
        "waiting_trusted_contact": sum(1 for t in rows if t.status == "waiting_trusted_contact"),
        "in_call": sum(1 for t in rows if t.status == "in_verification_call"),
        "cancelled": sum(1 for t in rows if t.status == "cancelled"),
        "money_protected": str(protected),
    }


@router.get("/cases")
def cases(user: User = Depends(staff_only), db: Session = Depends(get_db),
          status: str | None = Query(None), tier: str | None = Query(None)):
    q = _cases_query()
    if status:
        q = q.where(Transfer.status.in_(status.split(",")))
    if tier:
        q = q.where(Transfer.risk_tier.in_(tier.split(",")))
    rows = db.scalars(q.order_by(Transfer.created_at.desc()).limit(200)).all()
    rows.sort(key=lambda t: (t.status in CLOSED, t.status == "escalated", TIER_ORDER.get(t.risk_tier, 9),
                             -t.risk_score, -as_utc(t.created_at).timestamp()))
    # Live verification calls always go to the top.
    rows.sort(key=lambda t: t.status != "in_verification_call")
    return [case_row(db, t) for t in rows]


def _get_case(db: Session, case_id: int) -> Transfer:
    t = db.get(Transfer, case_id)
    if not t or t.is_seed_history:
        raise HTTPException(404, "Case not found.")
    return t


def evidence_for(db: Session, t: Transfer) -> list[dict]:
    rows = db.scalars(select(EvidenceEvent).where(EvidenceEvent.transfer_id == t.id).order_by(EvidenceEvent.id)).all()
    return [{"id": e.id, "actor": e.actor, "event_type": e.event_type, "detail": e.detail_json,
             "created_at": as_utc(e.created_at)} for e in rows]


@router.get("/cases/{case_id}")
def case_detail(case_id: int, user: User = Depends(staff_only), db: Session = Depends(get_db)):
    t = _get_case(db, case_id)
    acct = db.scalar(select(Account).where(Account.user_id == t.customer_user_id))
    calls = db.scalars(select(CallSession).where(CallSession.transfer_id == t.id).order_by(CallSession.id)).all()
    actions = db.scalars(select(StaffAction).where(StaffAction.transfer_id == t.id).order_by(StaffAction.id)).all()
    mean, std = acct.typical_transfer_mean, acct.typical_transfer_std
    return {
        **case_row(db, t),
        "usual": {"mean": str(mean), "std": str(std),
                  "times_usual": float(round(t.amount / mean, 1)) if mean else None},
        "evidence": evidence_for(db, t),
        "calls": [call_out(c) for c in calls],
        "attached_messages": [{"id": m.id, "text_redacted": m.text_redacted, "verdict": m.verdict,
                               "flags": [f["key"] for f in m.flags_json or []], "ml_probability": m.ml_probability,
                               "review_status": m.review_status, "created_at": as_utc(m.created_at)}
                              for m in attached_messages(db, t.id)],
        "staff_actions": [{"id": a.id, "staff": a.staff.display_name, "action": a.action, "note": a.note,
                           "created_at": as_utc(a.created_at)} for a in actions],
    }


@router.post("/cases/{case_id}/actions")
def act(case_id: int, body: ActionIn, user: User = Depends(staff_only), db: Session = Depends(get_db)):
    t = _get_case(db, case_id)
    if t.status in CLOSED:
        raise HTTPException(409, f"This case is already closed ({t.status.replace('_', ' ')}).")
    actor = staff_actor(user.id)
    note = body.note.strip()
    db.add(StaffAction(staff_user_id=user.id, transfer_id=t.id, action=body.action, note=note))
    call = None
    if body.action == "approve":
        move_money(db, t, "approved_by_staff", actor)
        log_event(db, t.id, actor, "staff_approved", {"note": note})
    elif body.action == "genuine":
        t.false_positive = True
        move_money(db, t, "approved_by_staff", actor)
        log_event(db, t.id, actor, "staff_marked_genuine", {"note": note, "false_positive": True})
    elif body.action == "escalate":
        t.status = "escalated"
        log_event(db, t.id, actor, "escalated_anti_scam_centre", {"note": note})
    elif body.action == "call":
        call = staff_starts_call(db, user, t)
        log_event(db, t.id, actor, "staff_note", {"note": note})
    db.commit()
    if call:
        db.refresh(call)
        hub.notify({"type": "call.incoming", "call": call_out(call)}, user_ids=[t.customer_user_id])
    notify_transfer(db, t)
    return {"case": case_detail(case_id, user, db), "call": call_out(call) if call else None}


def referral_data(db: Session, t: Transfer, staff: User) -> dict:
    c = t.customer
    return {
        "referral_type": "Anti-Scam Centre referral (student prototype, synthetic data)",
        "generated_at": utcnow().isoformat(),
        "generated_by": staff.display_name,
        "case_id": f"SB-{t.id:06d}",
        "customer": {"name": c.display_name, "age": c.age, "contact": c.phone_masked or "masked"},
        "payee": {"name": t.payee.name, "account_ref": t.payee.account_ref[:5] + "•••",
                  "new_payee": any(r["key"] == "new_payee" for r in t.reasons_json or [])},
        "amount_sgd": str(t.amount),
        "status": t.status,
        "risk": {"score": t.risk_score, "tier": t.risk_tier, "reasons": [r["text"] for r in t.reasons_json or []]},
        "signals": {k: v for k, v in (t.signals_json or {}).items() if k != "source"},
        "answers": t.answers_json,
        "evidence_timeline": [{k: str(v) if k == "created_at" else v for k, v in e.items() if k != "id"}
                              for e in evidence_for(db, t)],
        "disclaimer": "Student prototype for OCBC IGNITE 2026, not an official OCBC product.",
    }


@router.get("/cases/{case_id}/referral.json")
def referral_json(case_id: int, user: User = Depends(staff_only), db: Session = Depends(get_db)):
    return referral_data(db, _get_case(db, case_id), user)


@router.get("/cases/{case_id}/referral.html", response_class=HTMLResponse)
def referral_html(case_id: int, user: User = Depends(staff_only), db: Session = Depends(get_db)):
    d = referral_data(db, _get_case(db, case_id), user)
    e = html.escape
    rows = "".join(
        f"<tr><td>{e(ev['created_at'][:19].replace('T', ' '))}</td><td>{e(ev['actor'])}</td>"
        f"<td>{e(ev['event_type'].replace('_', ' '))}</td><td>{e(str(ev['detail']))}</td></tr>"
        for ev in d["evidence_timeline"])
    reasons = "".join(f"<li>{e(r)}</li>" for r in d["risk"]["reasons"])
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Referral {e(d['case_id'])}</title>
<style>body{{font-family:'IBM Plex Sans',system-ui,sans-serif;color:#0F172A;margin:32px;max-width:900px}}
h1{{font-size:24px}}table{{border-collapse:collapse;width:100%;font-size:13px}}td,th{{border:1px solid #E2E8F0;padding:6px;text-align:left;vertical-align:top}}
.banner{{background:#0F172A;color:#fff;padding:8px 12px;border-radius:8px;font-size:13px}}dt{{font-weight:600}}dd{{margin:0 0 8px}}</style></head>
<body><p class="banner">{e(d['disclaimer'])}</p><h1>{e(d['referral_type'])}</h1>
<dl><dt>Case</dt><dd>{e(d['case_id'])} — status {e(d['status'])}</dd>
<dt>Generated</dt><dd>{e(d['generated_at'][:19])} UTC by {e(d['generated_by'])}</dd>
<dt>Customer</dt><dd>{e(d['customer']['name'])}, age {d['customer']['age']}, contact {e(d['customer']['contact'])}</dd>
<dt>Payee</dt><dd>{e(d['payee']['name'])} ({e(d['payee']['account_ref'])}){' — NEW payee' if d['payee']['new_payee'] else ''}</dd>
<dt>Amount</dt><dd>S${Decimal(d['amount_sgd']):,.2f}</dd>
<dt>Risk</dt><dd>score {d['risk']['score']} ({e(d['risk']['tier'])})<ul>{reasons}</ul></dd>
<dt>Signals</dt><dd>{e(str(d['signals']))}</dd><dt>Answers</dt><dd>{e(str(d['answers']))}</dd></dl>
<h2>Evidence timeline</h2><table><thead><tr><th>Time (UTC)</th><th>Actor</th><th>Event</th><th>Detail</th></tr></thead><tbody>{rows}</tbody></table>
<script>window.addEventListener('load',()=>{{if(location.hash==='#print')window.print()}})</script></body></html>"""


# --- reported messages -----------------------------------------------------------------------
@router.get("/messages")
def reported_messages(user: User = Depends(staff_only), db: Session = Depends(get_db)):
    rows = db.scalars(select(MessageCheck).where(MessageCheck.reported.is_(True)).order_by(MessageCheck.id.desc())).all()
    return [{"id": m.id, "customer": m.user.display_name, "text_redacted": m.text_redacted, "flags": m.flags_json,
             "ml_probability": m.ml_probability, "verdict": m.verdict, "review_status": m.review_status,
             "source_channel": m.source_channel, "scam_type": m.scam_type, "user_feedback": m.user_feedback,
             "training_candidate": m.training_candidate, "created_at": as_utc(m.created_at)} for m in rows]


class LabelIn(BaseModel):
    scam_type: str | None = Field(default=None, max_length=32)
    training_candidate: bool | None = None


@router.post("/messages/{msg_id}/label")
def label_message(msg_id: int, body: LabelIn, user: User = Depends(staff_only), db: Session = Depends(get_db)):
    """Staff correct the scam type or mark a message as a candidate for the training set.
    Candidates are only exported for OFFLINE review; the model is never retrained automatically."""
    from ..classifier import SCAM_TYPES

    m = db.get(MessageCheck, msg_id)
    if not m or not m.reported:
        raise HTTPException(404, "Reported message not found.")
    if body.scam_type is not None:
        if body.scam_type not in SCAM_TYPES and body.scam_type != "not_scam":
            raise HTTPException(422, {"field": "scam_type", "message": "Choose a scam type from the list."})
        m.scam_type = body.scam_type
    if body.training_candidate is not None:
        m.training_candidate = body.training_candidate
    db.add(StaffAction(staff_user_id=user.id, transfer_id=None, action="message_labelled",
                       note=f"scam_type={m.scam_type}; training_candidate={m.training_candidate}"))
    log_event(db, None, staff_actor(user.id), "message_labelled",
              {"message_check_id": m.id, "scam_type": m.scam_type, "training_candidate": m.training_candidate})
    db.commit()
    hub.notify({"type": "message.updated", "id": m.id}, staff=True)
    return {"id": m.id, "scam_type": m.scam_type, "training_candidate": m.training_candidate}


@router.get("/messages/training-candidates.csv", response_class=PlainTextResponse)
def training_candidates(user: User = Depends(staff_only), db: Session = Depends(get_db)):
    """Redacted text only, for offline review by the team before anything is added to data/messages.csv."""
    import csv
    import io

    rows = db.scalars(select(MessageCheck).where(MessageCheck.training_candidate.is_(True)).order_by(MessageCheck.id)).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["text_redacted", "label", "scam_type", "channel", "checker_verdict", "rule_pack_version"])
    for m in rows:
        w.writerow([m.text_redacted, "legit" if m.scam_type == "not_scam" else "scam", m.scam_type or "",
                    m.source_channel or "", m.verdict, m.rule_pack_version or ""])
    return PlainTextResponse(buf.getvalue(), media_type="text/csv",
                             headers={"Content-Disposition": 'attachment; filename="training-candidates.csv"'})


@router.post("/messages/{msg_id}/review")
def review_message(msg_id: int, body: ReviewIn, user: User = Depends(staff_only), db: Session = Depends(get_db)):
    m = db.get(MessageCheck, msg_id)
    if not m or not m.reported:
        raise HTTPException(404, "Reported message not found.")
    m.review_status = body.review_status
    db.add(StaffAction(staff_user_id=user.id, transfer_id=None, action=f"message_{body.review_status}",
                       note=body.note.strip()))
    log_event(db, None, staff_actor(user.id), f"message_{body.review_status}", {"message_check_id": m.id})
    db.commit()
    hub.notify({"type": "message.updated", "id": m.id}, staff=True)
    return {"id": m.id, "review_status": m.review_status}


@router.get("/audit")
def audit(user: User = Depends(staff_only), db: Session = Depends(get_db), since_hours: int = 72):
    since = utcnow() - timedelta(hours=since_hours)
    rows = db.scalars(select(StaffAction).where(StaffAction.created_at >= since).order_by(StaffAction.id.desc())).all()
    return [{"id": a.id, "staff": a.staff.display_name, "transfer_id": a.transfer_id, "action": a.action,
             "note": a.note, "created_at": as_utc(a.created_at)} for a in rows]
