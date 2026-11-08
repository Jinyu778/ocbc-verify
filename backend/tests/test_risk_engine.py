from decimal import Decimal

import pytest

from app.risk_engine import Signals, assess, tier_for

D = Decimal
NO = Signals()


def run(amount="50", new=False, sig=NO, mean="100", std="50", answers=None):
    return assess(amount=D(amount), is_new_payee=new, signals=sig, history_mean=D(mean) if mean else None,
                  history_std=D(std) if std else None, answers=answers)


def keys(r):
    return [x.key for x in r.reasons]


@pytest.mark.parametrize("score,tier", [(0, "none"), (2, "none"), (3, "ask"), (5, "ask"), (6, "pause"), (12, "pause")])
def test_tier_boundaries(score, tier):
    assert tier_for(score) == tier


def test_zero_friction_known_small():
    r = run("45")
    assert r.score == 0 and r.tier == "none" and r.reasons == []


def test_new_payee_two_points():
    r = run("45", new=True)
    assert r.score == 2 and r.tier == "none" and keys(r) == ["new_payee"]


@pytest.mark.parametrize("field,key", [("on_call", "on_call"), ("recent_call", "recent_call"),
                                       ("chatting", "chatting"), ("screen_sharing", "screen_sharing")])
def test_each_live_signal_two_points(field, key):
    r = run("45", sig=Signals(**{field: True}))
    assert r.score == 2 and keys(r) == [key] and r.tier == "none"


@pytest.mark.parametrize("amount,pts,key", [
    ("999.99", 0, None), ("1000", 1, "amount_medium"), ("1000.00", 1, "amount_medium"),
    ("9999.99", 1, "amount_medium"), ("10000", 2, "amount_high"), ("10000.00", 2, "amount_high"), ("50000", 2, "amount_high"),
])
def test_amount_bands_boundaries(amount, pts, key):
    # huge std so the unusual-amount rule never fires here
    r = run(amount, mean="5000", std="100000")
    assert r.score == pts
    assert (key in keys(r)) if key else keys(r) == []
    assert not ("amount_medium" in keys(r) and "amount_high" in keys(r))  # not cumulative


def test_unusual_amount_z_ge_3():
    assert "unusual_amount" in keys(run("250", mean="100", std="50"))  # z = 3.0 exactly
    assert "unusual_amount" not in keys(run("249.99", mean="100", std="50"))
    r = run("250", mean="100", std="50")
    assert r.score == 2 and r.reasons[0].text == "This is much larger than your usual payments."


def test_unusual_amount_skipped_without_history():
    assert "unusual_amount" not in keys(run("9000", mean="100", std="0"))
    assert "unusual_amount" not in keys(run("9000", mean=None, std=None))


def test_each_yes_three_points():
    for q in ("q_phone", "q_secret", "q_online"):
        r = run("45", answers={q: True})
        assert r.score == 3 and r.tier == "ask"


def test_chat_answer_sets_chatting_once():
    r = run("45", answers={"q_chat": True})
    assert r.score == 3 + 2
    r2 = run("45", sig=Signals(chatting=True), answers={"q_chat": True})
    assert r2.score == 3 + 2  # chatting counted once
    assert keys(r2).count("chatting") == 1


def test_ask_tier():
    r = run("3200", new=True, mean="200", std="150")  # new 2 + amount 1 + unusual 2
    assert r.score == 5 and r.tier == "ask"


def test_pause_tier():
    r = run("8000", new=True, sig=Signals(on_call=True), mean="200", std="150")
    assert r.score == 7 and r.tier == "pause"


@pytest.mark.parametrize("field", ["on_call", "recent_call", "chatting", "screen_sharing"])
def test_override_new_payee_plus_live_signal(field):
    r = run("20", new=True, sig=Signals(**{field: True}),
            answers={"q_phone": False, "q_secret": False, "q_online": False, "q_chat": False})
    assert r.score == 4
    assert r.tier == "pause" and r.override
    assert "override_new_payee_live" in keys(r)


def test_no_override_known_payee_with_call():
    r = run("20", sig=Signals(on_call=True))
    assert r.tier == "none" and not r.override


def test_override_from_chat_answer():
    r = run("20", new=True, answers={"q_chat": True})
    assert r.tier == "pause"


def test_signals_unavailable_asks_for_new_payee():
    r = run("20", new=True, sig=Signals(available=False))
    assert r.tier == "ask" and "signals_unavailable" in keys(r)


def test_signals_unavailable_known_small_still_fast():
    assert run("20", sig=Signals(available=False)).tier == "none"


def test_every_reason_has_text():
    r = run("20000", new=True, sig=Signals(True, True, True, True), mean="100", std="10",
            answers={"q_phone": True, "q_secret": True, "q_online": True, "q_chat": True})
    assert all(x.text for x in r.reasons)
    assert r.score == 2 + 8 + 2 + 2 + 12
