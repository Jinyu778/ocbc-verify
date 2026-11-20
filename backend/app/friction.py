"""When may a paused customer use "Continue anyway"?

Pure functions: no I/O and no clock (the caller passes the times in), like the risk engine.

Zero-trust idea: an inbound caller is never proof of anything, and phone scams depend on keeping
the victim on the line. So when a phone call is part of a paused payment, "Continue anyway" stays
locked until the call has ended AND a cooling-off time has passed (HANG_UP_WAIT_MINUTES, by default
1 minute). A scammer can say "wait a moment and tap Continue"; they cannot stay on the line while
the call-free wait runs.

Nothing is blocked permanently: once the wait is over, the customer decides.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from .risk_engine import Signals


def hang_up_required(signals: Signals, answers: dict | None) -> bool:
    """A phone call is part of this payment: on a call now, a call that just ended, or the customer
    said someone on the phone is telling them to pay."""
    return bool(signals.on_call or signals.recent_call or (answers or {}).get("q_phone"))


def continue_anyway_at(
    *,
    pause_shown_at: datetime | None,
    read_seconds: int,
    hang_up_needed: bool,
    call_ended_at: datetime | None,
    hang_up_wait_minutes: int,
) -> datetime | None:
    """The earliest time "Continue anyway" may be used, or None if it is not available yet
    (no pause shown, or the customer still has to hang up)."""
    if pause_shown_at is None:
        return None
    ready = pause_shown_at + timedelta(seconds=read_seconds)
    if hang_up_needed:
        if call_ended_at is None:
            return None
        ready = max(ready, call_ended_at + timedelta(minutes=hang_up_wait_minutes))
    return ready
