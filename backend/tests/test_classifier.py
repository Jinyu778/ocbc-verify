import pytest

from app import classifier
from app.redact import redact


def test_heldout_metrics_meet_targets():
    m = classifier.train(save=False)
    print("held-out metrics:", m)
    assert m["n_total"] >= 400
    assert m["recall_scam"] >= 0.9
    # harder split: entire templates held out
    assert m["grouped_by_template"]["recall_scam"] >= 0.9
    assert m["grouped_by_template"]["accuracy"] >= 0.8


def test_rules_fire_with_explanations():
    flags = classifier.apply_rules("This is the MAS officer. Move money to a safe account now and keep this secret. Send your OTP.")
    keys = {f["key"] for f in flags}
    assert {"authority", "safe_account", "secrecy", "credentials", "urgency"} <= keys
    assert all(f["explanation"] and f["spans"] for f in flags)


def test_not_sure_band():
    assert classifier.verdict_for([], 0.5) == "not_sure"
    assert classifier.verdict_for([], 0.4) == "not_sure"
    assert classifier.verdict_for([], 0.6) == "not_sure"
    assert classifier.verdict_for([{"key": "safe_account", "strong": True}], 0.5) == "likely_scam"


def test_verdicts():
    assert classifier.verdict_for([], 0.05) == "no_signs"
    assert classifier.verdict_for([], 0.95) == "likely_scam"
    assert classifier.verdict_for([{"key": "link", "strong": False}], 0.7) == "be_careful"


def test_samples():
    assert classifier.check("Hi Mum, this is my new number. My phone broke. Can you transfer $3,000 to my friend's account? Urgent")["verdict"] == "likely_scam"
    assert classifier.check("Hey, are we still meeting at the hawker centre at 7 on Friday?")["verdict"] == "no_signs"


def test_redaction():
    out = redact("Call +65 9123 4567 or 81234567, email a@b.com, visit https://evil.example.com/path?x=1")
    assert "9123" not in out and "81234567" not in out and "a@b.com" not in out
    assert "[link: evil.example.com]" in out and "/path" not in out


def test_task9_pokemon_preorder_rule():
    scam = "Pokemon card pre-order! Booster box $120, PayNow first to secure your slot, no meetup, will mail when stock arrives."
    r = classifier.check(scam)
    assert r["verdict"] == "likely_scam"
    assert {"preorder_scam", "paynow_first"} <= {f["key"] for f in r["flags"]}
    # all three parts are needed: a normal shop pre-order is not flagged
    assert "preorder_scam" not in {f["key"] for f in classifier.apply_rules("Pokémon pre-orders open on our website. Pay when you collect in store.")}
    assert "preorder_scam" not in {f["key"] for f in classifier.apply_rules("Pre-order now, PayNow accepted, meet at Bishan MRT.")}


# --- zero trust: a message that asks you to act is never "no signs" ----------------------------
def test_request_to_act_is_never_no_signs():
    flags = classifier.apply_rules("Hi, please pay your outstanding bill of $42.10 by Friday.")
    assert "asks_action" in {f["key"] for f in flags}
    assert classifier.verdict_for(flags, 0.05) == "be_careful"


def test_request_to_act_alone_never_makes_likely_scam():
    # one strong sign + a request is not "two signs": the request is not a scam sign by itself
    strong = {"key": "credentials", "strong": True}
    action = {"key": "asks_action", "strong": False}
    assert classifier.verdict_for([strong, action], 0.2) == "be_careful"
    assert classifier.verdict_for([strong, {"key": "urgency", "strong": False}], 0.2) == "likely_scam"


def test_plain_chat_still_no_signs():
    assert "asks_action" not in {f["key"] for f in classifier.apply_rules("Are we still meeting at 7 on Friday?")}


@pytest.mark.parametrize("text", [
    "Click here to claim your prize",
    "Please transfer the balance today",
    "Log in to update your account details",
    "请立即转账",
    "Sila bayar sekarang",
])
def test_action_phrases(text):
    assert "asks_action" in {f["key"] for f in classifier.apply_rules(text)}
