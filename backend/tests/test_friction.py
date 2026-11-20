from datetime import datetime, timedelta, timezone

import pytest

from app.friction import continue_anyway_at, hang_up_required
from app.risk_engine import Signals

T0 = datetime(2026, 11, 20, 10, 0, tzinfo=timezone.utc)


def at(**kw):
    base = dict(pause_shown_at=T0, read_seconds=30, hang_up_needed=False, call_ended_at=None, hang_up_wait_minutes=10)
    return continue_anyway_at(**{**base, **kw})


@pytest.mark.parametrize("signals,answers,expected", [
    (Signals(), None, False),
    (Signals(on_call=True), None, True),
    (Signals(recent_call=True), None, True),
    (Signals(chatting=True), None, False),          # chats: nothing to hang up
    (Signals(screen_sharing=True), None, False),
    (Signals(), {"q_phone": True}, True),           # "someone on the phone is telling me to pay"
    (Signals(), {"q_phone": False, "q_chat": True}, False),
])
def test_hang_up_required(signals, answers, expected):
    assert hang_up_required(signals, answers) is expected


def test_no_pause_no_continue():
    assert at(pause_shown_at=None) is None


def test_reading_time_only_without_a_call():
    assert at() == T0 + timedelta(seconds=30)


def test_locked_while_on_the_call():
    assert at(hang_up_needed=True) is None


def test_wait_counts_from_the_end_of_the_call():
    ended = T0 + timedelta(minutes=3)
    assert at(hang_up_needed=True, call_ended_at=ended) == ended + timedelta(minutes=10)


def test_reading_time_still_applies_if_call_ended_long_before():
    ended = T0 - timedelta(hours=1)
    assert at(hang_up_needed=True, call_ended_at=ended) == T0 + timedelta(seconds=30)
