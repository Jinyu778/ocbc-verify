import json
import statistics
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..classifier import METRICS_PATH
from ..db import get_db
from ..models import HELD_STATUSES, MessageCheck, Transfer, User
from ..security import require_role
from ..services import as_utc

router = APIRouter(prefix="/api", tags=["metrics"])


def pct(n: int, d: int) -> float:
    return round(100 * n / d, 1) if d else 0.0


@router.get("/metrics")
def metrics(user: User = Depends(require_role("staff")), db: Session = Depends(get_db)):
    ts = db.scalars(select(Transfer).where(Transfer.is_seed_history.is_(False))).all()
    total = len(ts)
    zero = [t for t in ts if t.risk_tier == "none"]
    paused = [t for t in ts if t.risk_tier == "pause"]
    cancelled_after_pause = [t for t in paused if t.status == "cancelled"]
    genuine = [t for t in ts if t.false_positive]
    protected = sum((t.amount for t in ts if t.risk_tier != "none" and
                     (t.status == "cancelled" or t.status in HELD_STATUSES)), Decimal("0"))
    # Extra seconds added to genuine (completed) payments; zero-friction payments add 0.
    extra = [0.0 if t.risk_tier == "none" else (as_utc(t.completed_at) - as_utc(t.created_at)).total_seconds()
             for t in ts if t.status in ("sent", "approved_by_staff") and t.completed_at]
    tc_times = [(as_utc(t.trusted_decided_at) - as_utc(t.trusted_requested_at)).total_seconds()
                for t in ts if t.trusted_decided_at and t.trusted_requested_at]
    checks = db.scalars(select(MessageCheck)).all()
    split: dict[str, int] = {"likely_scam": 0, "be_careful": 0, "not_sure": 0, "no_signs": 0}
    for c in checks:
        split[c.verdict] = split.get(c.verdict, 0) + 1
    model = json.loads(METRICS_PATH.read_text()) if METRICS_PATH.exists() else None
    return {
        "payments_checked": total,
        "pct_zero_friction": pct(len(zero), total),
        "pct_paused": pct(len(paused), total),
        "pct_cancelled_after_pause": pct(len(cancelled_after_pause), len(paused)),
        "pct_released_genuine": pct(len(genuine), len(paused)),
        "false_positives": len(genuine),
        "money_protected": str(protected),
        "median_extra_seconds_genuine": round(statistics.median(extra), 1) if extra else 0,
        "median_trusted_response_seconds": round(statistics.median(tc_times), 1) if tc_times else None,
        "message_checks": len(checks),
        "message_verdicts": split,
        "messages_reported": sum(1 for c in checks if c.reported),
        "model": model,
    }
