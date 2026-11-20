"""OCBC Verify risk engine.

Pure function: no I/O, no clock, no database. The server always calls this to decide the
tier; the client never does.

Points
  New payee                                   +2
  On a call now                               +2
  Call ended less than 10 minutes ago         +2
  Chatting about this payment                 +2   (signal OR answer to question d, counted once)
  Screen sharing                              +2
  Amount S$1,000 - S$9,999.99                 +1
  Amount S$10,000 and above                   +2   (not cumulative with the band above)
  Unusual amount (z-score >= 3 vs history)    +2
  Each "Yes" to a safety question             +3
  Payee account reported by other customers   +4
  Customer's own message check in the last 60 minutes was "Likely scam"   +2

Tiers: < 3 none, 3-5 ask, >= 6 pause.
Override: new payee AND any live signal (call, recent call, chatting, screen share) -> pause.
Override: new payee AND unusual amount (z >= 3) AND amount >= S$5,000 -> pause, whatever the
          customer answers. A coached victim who answers "No" to everything is still paused.

Answers can only RAISE risk: every "Yes" adds points and no answer removes any.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

QUESTION_KEYS = ("q_phone", "q_secret", "q_online", "q_chat")

REASON_TEXT = {
    "new_payee": "You have never paid this person or account before.",
    "on_call": "You are on a phone call right now.",
    "recent_call": "You finished a phone call less than 10 minutes ago.",
    "chatting": "Someone is messaging you about this payment.",
    "screen_sharing": "Your screen is being shared.",
    "amount_medium": "This is a large payment (S$1,000 or more).",
    "amount_high": "This is a very large payment (S$10,000 or more).",
    "unusual_amount": "This is much larger than your usual payments.",
    "q_phone": "You said someone on the phone is telling you to pay.",
    "q_secret": "You were told to keep this secret or move money to a 'safe' account.",
    "q_online": "You have only met this person online or by phone.",
    "q_chat": "You said someone is messaging you, telling you to pay.",
    "override_new_payee_live": "A new payee while you are on a call or chat is a common scam pattern.",
    "override_new_payee_unusual_large": "A large, unusual payment to someone new is how most scams end. We always pause these.",
    "payee_reported": "This account was reported by other customers.",
    "recent_scam_check": "You recently checked a message that looked like a scam.",
    "signals_unavailable": "We could not check your phone for calls, so we're asking a few questions.",
}

LIVE_SIGNALS = ("on_call", "recent_call", "chatting", "screen_sharing")
UNUSUAL_Z = Decimal("3")
MEDIUM_MIN = Decimal("1000")
COACHED_PAUSE_MIN = Decimal("5000")
HIGH_MIN = Decimal("10000")


@dataclass(frozen=True)
class Signals:
    on_call: bool = False
    recent_call: bool = False
    chatting: bool = False
    screen_sharing: bool = False
    available: bool = True  # False when permission was denied or the provider failed

    @classmethod
    def from_dict(cls, d: dict | None) -> Signals:
        d = d or {}
        return cls(
            on_call=bool(d.get("on_call", False)),
            recent_call=bool(d.get("recent_call", False)),
            chatting=bool(d.get("chatting", False)),
            screen_sharing=bool(d.get("screen_sharing", False)),
            available=bool(d.get("available", True)),
        )


@dataclass
class Reason:
    key: str
    points: int
    text: str

    def as_dict(self) -> dict:
        return {"key": self.key, "points": self.points, "text": self.text}


@dataclass
class RiskResult:
    score: int
    tier: str  # none | ask | pause
    reasons: list[Reason] = field(default_factory=list)
    override: bool = False
    z_score: float | None = None

    def reasons_dicts(self) -> list[dict]:
        return [r.as_dict() for r in self.reasons]


def amount_z_score(amount: Decimal, mean: Decimal, std: Decimal) -> float | None:
    if std is None or mean is None or Decimal(std) <= 0:
        return None
    return float((Decimal(amount) - Decimal(mean)) / Decimal(std))


def tier_for(score: int) -> str:
    if score >= 6:
        return "pause"
    if score >= 3:
        return "ask"
    return "none"


def assess(
    *,
    amount: Decimal,
    is_new_payee: bool,
    signals: Signals,
    history_mean: Decimal | None,
    history_std: Decimal | None,
    answers: dict | None = None,
    payee_reported_by_others: int = 0,
    recent_scam_check: bool = False,
) -> RiskResult:
    amount = Decimal(amount)
    answers = answers or {}
    reasons: list[Reason] = []

    def add(key: str, pts: int) -> None:
        reasons.append(Reason(key, pts, REASON_TEXT[key]))

    if is_new_payee:
        add("new_payee", 2)
    if signals.on_call:
        add("on_call", 2)
    if signals.recent_call:
        add("recent_call", 2)
    chatting = signals.chatting or bool(answers.get("q_chat"))
    if chatting:
        add("chatting", 2)
    if signals.screen_sharing:
        add("screen_sharing", 2)

    if amount >= HIGH_MIN:
        add("amount_high", 2)
    elif amount >= MEDIUM_MIN:
        add("amount_medium", 1)

    z = amount_z_score(amount, history_mean, history_std) if history_mean is not None else None
    if z is not None and z >= float(UNUSUAL_Z):
        add("unusual_amount", 2)

    if payee_reported_by_others > 0:
        add("payee_reported", 4)
    if recent_scam_check:  # only what the customer chose to check; the app never reads their messages
        add("recent_scam_check", 2)

    for q in QUESTION_KEYS:
        if answers.get(q) is True:
            add(q, 3)

    score = sum(r.points for r in reasons)
    tier = tier_for(score)

    live = signals.on_call or signals.recent_call or chatting or signals.screen_sharing
    override = False
    if is_new_payee and live and tier != "pause":
        tier = "pause"
        override = True
        reasons.append(Reason("override_new_payee_live", 0, REASON_TEXT["override_new_payee_live"]))

    # Coached-victim override: does not depend on any answer or self-reported signal.
    unusual = z is not None and z >= float(UNUSUAL_Z)
    if is_new_payee and unusual and amount >= COACHED_PAUSE_MIN and tier != "pause":
        tier = "pause"
        override = True
        reasons.append(Reason("override_new_payee_unusual_large", 0, REASON_TEXT["override_new_payee_unusual_large"]))

    # Unknown signals (permission denied / provider failed): we cannot rule out a call, so a
    # new payee or a large amount gets the questions instead of zero friction.
    if not signals.available and tier == "none" and (is_new_payee or amount >= MEDIUM_MIN):
        tier = "ask"
        reasons.append(Reason("signals_unavailable", 0, REASON_TEXT["signals_unavailable"]))

    return RiskResult(score=score, tier=tier, reasons=reasons, override=override, z_score=z)
