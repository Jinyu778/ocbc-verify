from app import classifier
from app.redact import redact


def test_heldout_metrics_meet_targets():
    m = classifier.train(save=False)
    print("held-out metrics:", m)
    assert m["n_total"] >= 900
    g = m["grouped_by_template"]
    assert g["recall_scam"] >= 0.8  # the model alone, on template families it never saw
    # what customers see (rules + model) on unseen template families: docs/MODEL_CARD.md targets
    assert g["checker"]["recall_scam"] >= 0.9
    assert g["checker"]["legit_shown_likely_scam"] <= 0.05
    assert g["checker"]["hard_negative_shown_likely_scam"] <= 0.10
    u = m["unseen_tactics"]
    assert u["n"] >= 60 and u["checker"]["recall_scam"] >= 0.9 and u["checker"]["legit_shown_likely_scam"] <= 0.05


def test_rules_fire_with_explanations():
    flags = classifier.apply_rules("This is the MAS officer. Move money to a safe account immediately and keep this secret. Send your OTP.")
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
    assert classifier.verdict_for([], 0.95) == "be_careful"  # the model alone never says "Likely scam"
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


# ---- researched rule pack ------------------------------------------------------------------
def _keys(text, source=None):
    return {f["key"] for f in classifier.apply_rules(text, source)}


def test_protective_otp_notice_is_not_flagged():
    genuine = "OCBC: Your OTP is 123456. Never share your OTP with anyone, including OCBC staff. We will never ask for it."
    assert "credentials" not in _keys(genuine)
    r = classifier.check(genuine)
    assert r["verdict"] in {"no_signs", "not_sure"}
    assert "protective_advice" in r["counter_evidence"]
    assert "credentials" in _keys("Please reply with your OTP to verify your account now")


def test_government_official_sample():
    r = classifier.check("This is Inspector Lim from the Police. Your identity was used in money laundering. Transfer your savings to a safe account and tell no one.")
    assert r["verdict"] == "likely_scam" and r["scam_type"] == "government_official"
    assert r["advice"] and r["rule_pack_version"]


def test_one_weak_signal_is_not_a_scam():
    assert classifier.verdict_for([{"key": "urgency", "strong": False, "family": "urgency"}], 0.1) == "no_signs"
    assert "link" in _keys("Details at https://www.ocbc.com/personal-banking")
    assert classifier.check("Your bill is ready, see https://www.spgroup.com.sg")["verdict"] != "likely_scam"


def test_bank_sms_with_link_is_strong_only_for_sms():
    text = "SingPost: your parcel is held. Pay the fee at https://singpost-redelivery.top/pay"
    assert "bank_sms_link" in _keys(text, "sms")
    assert "bank_sms_link" not in _keys(text, "email")
    assert "lookalike_link" in _keys(text)
    assert classifier.check(text, "sms")["verdict"] == "likely_scam"


def test_link_checks():
    assert "short_link" in _keys("click bit.ly/3abcde to continue")
    assert "lookalike_link" in _keys("Verify at http://ocbc-secure-login.com now")
    assert "lookalike_link" in _keys("Login at http://0cbc.com")
    assert "lookalike_link" not in _keys("Please visit https://www.ocbc.com/security")


def test_obfuscation_is_normalised():
    assert "safe_account" in _keys("move money to a s a f e  a c c o u n t")
    assert "safe_account" in _keys("move money to a saf​e account")
    assert "safe_account" in _keys("ｍｏｖｅ money to a ｓａｆｅ ａｃｃｏｕｎｔ")
    assert "link" in _keys("go to hxxp://evil[.]top/login")
    flags = classifier.apply_rules("move money to a saf​e account")
    a, b = flags[[f["key"] for f in flags].index("safe_account")]["spans"][0]
    assert "saf" in "move money to a saf​e account"[a:b]


def test_new_playbooks():
    assert classifier.check("Collect your loan! Instant loan approved, pay S$300 admin fee first. WhatsApp us")["verdict"] != "no_signs"
    assert "handover_cash" in _keys("A courier will collect your gold bars and cash for the investigation")
    assert "change_bank_details" in _keys("Urgent: our bank details have changed. Please pay the invoice to the new account number.")
    assert "family_new_number" in _keys("Hi mum guess who? This is my new number")


def test_empty_and_odd_input():
    assert classifier.check("ok")["verdict"] in {"no_signs", "not_sure"}
    assert classifier.check("<script>alert(1)</script>")["verdict"] != "likely_scam"
