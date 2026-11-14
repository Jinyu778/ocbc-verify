from decimal import Decimal

import pytest
from sqlalchemy import select

from app import db as db_module
from app.models import EvidenceEvent, EvidenceImmutableError, Transfer

from .conftest import backdate, balance, payee_id

ALL_NO = {"q_phone": False, "q_secret": False, "q_online": False, "q_chat": False}
CALL = {"on_call": True, "recent_call": False, "chatting": False, "screen_sharing": False, "available": True}


def create(client, h, payee, amount, signals=None):
    return client.post("/api/transfers", headers=h,
                       json={"payee_id": payee_id(client, h, payee), "amount": amount, "signals": signals or {}})


def events(tid):
    with db_module.SessionLocal() as s:
        return [e.event_type for e in s.scalars(select(EvidenceEvent).where(EvidenceEvent.transfer_id == tid)
                                                .order_by(EvidenceEvent.id))]


# --- auth & roles ------------------------------------------------------------------------
def test_login_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": "ryan.lim", "password": "nope"})
    assert r.status_code == 401


def test_login_rate_limited(client):
    for _ in range(5):
        client.post("/api/auth/login", json={"username": "ryan.lim", "password": "nope"})
    r = client.post("/api/auth/login", json={"username": "ryan.lim", "password": "Test1234!"})
    assert r.status_code == 429


def test_refresh_token(client):
    r = client.post("/api/auth/login", json={"username": "ryan.lim", "password": "Test1234!"}).json()
    r2 = client.post("/api/auth/refresh", json={"refresh_token": r["refresh_token"]})
    assert r2.status_code == 200 and r2.json()["user"]["username"] == "ryan.lim"
    assert client.post("/api/auth/refresh", json={"refresh_token": r["access_token"]}).status_code == 401


def test_unauthenticated_rejected(client):
    assert client.get("/api/me/account").status_code == 401


def test_role_checks(client, auth):
    staff, cust, contact = auth("staff.anna"), auth("ryan.lim"), auth("mrs.lim")
    assert client.get("/api/staff/cases", headers=cust).status_code == 403
    assert client.get("/api/staff/cases", headers=contact).status_code == 403
    assert client.get("/api/metrics", headers=cust).status_code == 403
    assert client.post("/api/transfers", headers=staff, json={"payee_id": 1, "amount": "1"}).status_code == 403
    assert client.get("/api/trusted/requests", headers=cust).status_code == 403
    assert client.get("/api/staff/cases", headers=staff).status_code == 200


def test_cannot_see_other_customers_transfer(client, auth):
    h = auth("ryan.lim")
    tid = create(client, h, "SP Group", "10").json()["id"]
    assert client.get(f"/api/transfers/{tid}", headers=auth("aisha.rahman")).status_code == 404


# --- input validation --------------------------------------------------------------------
@pytest.mark.parametrize("amount,msg", [("0", "more than"), ("-5", "more than"), ("abc", "numbers"),
                                        ("1.234", "2 decimal"), ("999999", "balance")])
def test_invalid_amounts(client, auth, amount, msg):
    h = auth("ryan.lim")
    r = create(client, h, "SP Group", amount)
    assert r.status_code == 422
    assert r.json()["detail"]["field"] == "amount" and msg in r.json()["detail"]["message"]


def test_unknown_payee(client, auth):
    h = auth("ryan.lim")
    r = client.post("/api/transfers", headers=h, json={"payee_id": 99999, "amount": "10"})
    assert r.status_code == 422 and r.json()["detail"]["field"] == "payee_id"


def test_other_customers_payee_rejected(client, auth):
    other = payee_id(client, auth("tan.siewlan"), "SP Group")
    r = client.post("/api/transfers", headers=auth("ryan.lim"), json={"payee_id": other, "amount": "10"})
    assert r.status_code == 422


# --- scenarios -----------------------------------------------------------------------------
def test_scenario3_everyday_payment_zero_friction(client, auth):
    h = auth("tan.siewlan")
    before = Decimal(balance(client, h))
    t = create(client, h, "SP Group", "45").json()
    assert t["risk_tier"] == "none" and t["next_step"] == "confirm"
    assert Decimal(balance(client, h)) == before  # nothing moves before send
    s = client.post(f"/api/transfers/{t['id']}/send", headers=h).json()
    assert s["status"] == "sent"
    assert Decimal(balance(client, h)) == before - Decimal("45")


def test_scenario1_fake_mas_pause_then_call_then_escalate(client, auth):
    h = auth("tan.siewlan")
    before = balance(client, h)
    t = create(client, h, "MAS Safety Account – Lim K.", "8000", CALL).json()
    assert t["risk_tier"] == "pause" and t["next_step"] == "questions"
    p = client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO).json()
    assert p["status"] == "paused" and p["pause_shown_at"]
    # cannot send while paused
    assert client.post(f"/api/transfers/{t['id']}/send", headers=h).status_code == 409
    c = client.post("/api/calls", headers=h, json={"transfer_id": t["id"]})
    assert c.status_code == 201
    assert client.get(f"/api/transfers/{t['id']}", headers=h).json()["status"] == "in_verification_call"
    staff = auth("staff.anna")
    cases = client.get("/api/staff/cases", headers=staff).json()
    assert cases[0]["id"] == t["id"]  # verification calls go to top
    acc = client.post(f"/api/calls/{c.json()['id']}/accept", headers=staff).json()
    assert acc["status"] == "active" and acc["staff"]["display_name"] == "Anna Koh"
    v = client.get("/api/calls/active", headers=h).json()
    assert v["genuine"] is True and v["call"]["staff"]["display_name"] == "Anna Koh"
    r = client.post(f"/api/staff/cases/{t['id']}/actions", headers=staff,
                    json={"action": "escalate", "note": "Customer confirmed caller claimed to be MAS."})
    assert r.status_code == 200 and r.json()["case"]["status"] == "escalated"
    assert balance(client, h) == before
    ref = client.get(f"/api/staff/cases/{t['id']}/referral.json", headers=staff).json()
    assert ref["customer"]["contact"].count("•") >= 4 and ref["evidence_timeline"]
    html = client.get(f"/api/staff/cases/{t['id']}/referral.html", headers=staff)
    assert html.status_code == 200 and "Evidence timeline" in html.text
    ev = events(t["id"])
    for e in ("transfer_created", "risk_scored", "questions_answered", "pause_shown",
              "verification_call_requested", "call_connected", "escalated_anti_scam_centre"):
        assert e in ev


def test_scenario2_genuine_bill_ask_save_send(client, auth):
    h = auth("tan.siewlan")
    before = Decimal(balance(client, h))
    t = create(client, h, "Hospital – NUH Billing", "3200").json()
    assert t["risk_tier"] == "ask" and t["next_step"] == "questions"
    # can't skip the questions
    assert client.post(f"/api/transfers/{t['id']}/send", headers=h).status_code == 409
    a = client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO).json()
    assert a["risk_tier"] == "ask" and a["next_step"] == "confirm"
    s = client.post(f"/api/transfers/{t['id']}/save", headers=h, json={"minutes": 60}).json()
    assert s["status"] == "saved_for_later"
    r = client.post(f"/api/transfers/{t['id']}/send", headers=h)
    assert r.status_code == 409  # timer enforced on the server
    backdate(t["id"], "wait_until", 3601)  # time really passes
    sent = client.post(f"/api/transfers/{t['id']}/send", headers=h).json()
    assert sent["status"] == "sent"
    assert Decimal(balance(client, h)) == before - Decimal("3200")


def test_save_minutes_must_be_a_configured_option(client, auth):
    h = auth("tan.siewlan")
    t = create(client, h, "SP Group", "45").json()
    assert client.post(f"/api/transfers/{t['id']}/save", headers=h, json={"minutes": 2}).status_code == 422


def test_timer_elapses_naturally(client, auth):
    h = auth("tan.siewlan")
    t = create(client, h, "Hospital – NUH Billing", "3200").json()
    client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO)
    client.post(f"/api/transfers/{t['id']}/save", headers=h, json={"minutes": 60})
    backdate(t["id"], "wait_until", 3601)
    assert client.post(f"/api/transfers/{t['id']}/send", headers=h).json()["status"] == "sent"


def test_scenario4_customer_lies_still_paused(client, auth):
    h = auth("tan.siewlan")
    t = create(client, h, "MAS Safety Account – Lim K.", "8000", CALL).json()
    p = client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO).json()
    assert p["status"] == "paused" and p["risk_tier"] == "pause"


def test_override_small_amount_new_payee_on_call(client, auth):
    h = auth("ryan.lim")
    t = create(client, h, "Carousell Seller – ticketsg88", "20", CALL).json()
    p = client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO).json()
    assert p["status"] == "paused"
    assert any(r["key"] == "override_new_payee_live" for r in p["reasons"])


def test_continue_anyway_requires_30_seconds(client, auth):
    h = auth("tan.siewlan")
    before = Decimal(balance(client, h))
    t = create(client, h, "MAS Safety Account – Lim K.", "8000", CALL).json()
    client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO)
    r = client.post(f"/api/transfers/{t['id']}/continue-anyway", headers=h)
    assert r.status_code == 409 and "30 seconds" in r.json()["detail"]
    backdate(t["id"], "pause_shown_at", 29)
    assert client.post(f"/api/transfers/{t['id']}/continue-anyway", headers=h).status_code == 409
    backdate(t["id"], "pause_shown_at", 2)
    r = client.post(f"/api/transfers/{t['id']}/continue-anyway", headers=h)
    assert r.status_code == 200 and r.json()["status"] == "sent"
    assert Decimal(balance(client, h)) == before - Decimal("8000")
    ev = events(t["id"])
    assert "continue_anyway_rejected_too_early" in ev and "continue_anyway" in ev


def test_cancel_after_pause_no_money_moves(client, auth):
    h = auth("tan.siewlan")
    before = balance(client, h)
    t = create(client, h, "MAS Safety Account – Lim K.", "8000", CALL).json()
    client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO)
    c = client.post(f"/api/transfers/{t['id']}/cancel", headers=h).json()
    assert c["status"] == "cancelled" and balance(client, h) == before
    assert client.post(f"/api/transfers/{t['id']}/send", headers=h).status_code == 409


def test_insufficient_balance_at_send(client, auth):
    h = auth("ryan.lim")
    t1 = create(client, h, "Mrs Lim (mother)", "2000").json()
    t2 = create(client, h, "Mrs Lim (mother)", "2000").json()
    for t in (t1, t2):
        if t["next_step"] == "questions":
            client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO)
    assert client.post(f"/api/transfers/{t1['id']}/send", headers=h).json()["status"] == "sent"
    r = client.post(f"/api/transfers/{t2['id']}/send", headers=h)
    assert r.status_code == 409 and "not enough" in r.json()["detail"]


def test_signal_unavailable_logged_and_asks(client, auth):
    h = auth("ryan.lim")
    t = create(client, h, "Carousell Seller – ticketsg88", "20",
               {"available": False, "source": "native"}).json()
    assert t["risk_tier"] == "ask" and t["next_step"] == "questions"
    assert "signal_unavailable" in events(t["id"])


# --- trusted contact ------------------------------------------------------------------------
def test_scenario5_job_deposit_trusted_contact_stops(client, auth):
    h = auth("ryan.lim")
    before = balance(client, h)
    t = create(client, h, "HR Onboarding – J. Wong", "600", {"chatting": True}).json()
    p = client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO).json()
    assert p["status"] == "paused"
    w = client.post(f"/api/transfers/{t['id']}/ask-trusted", headers=h).json()
    assert w["status"] == "waiting_trusted_contact" and w["trusted_contact_name"] == "Mrs Lim"
    mom = auth("mrs.lim")
    req = client.get("/api/trusted/requests", headers=mom).json()["pending"]
    assert len(req) == 1
    view = req[0]
    # contact sees only the limited view
    assert set(view) >= {"customer_name", "amount_band", "payee_type", "reason_keys"}
    assert "balance" not in str(view) and "600" not in view["amount_band"].replace("S$100 – S$1,000", "")
    assert view["amount_band"] == "S$100 – S$1,000" and view["payee_type"] == "new"
    # someone else's contact can't decide
    assert client.post(f"/api/trusted/requests/{t['id']}/decision", headers=auth("daniel.tan"),
                       json={"decision": "ok"}).status_code == 404
    d = client.post(f"/api/trusted/requests/{t['id']}/decision", headers=mom, json={"decision": "stop"})
    assert d.status_code == 200
    assert client.get(f"/api/transfers/{t['id']}", headers=h).json()["status"] == "under_staff_review"
    assert client.post(f"/api/transfers/{t['id']}/send", headers=h).status_code == 409
    assert balance(client, h) == before
    # staff decide with the customer: not a permanent block
    r = client.post(f"/api/staff/cases/{t['id']}/actions", headers=auth("staff.anna"),
                    json={"action": "genuine", "note": "Called Ryan; employer verified via official site."})
    assert r.json()["case"]["status"] == "approved_by_staff"
    m = client.get("/api/metrics", headers=auth("staff.anna")).json()
    assert m["false_positives"] == 1 and m["median_trusted_response_seconds"] is not None


def test_trusted_contact_ok_lets_customer_send(client, auth):
    h = auth("ryan.lim")
    t = create(client, h, "HR Onboarding – J. Wong", "600", {"chatting": True}).json()
    client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO)
    client.post(f"/api/transfers/{t['id']}/ask-trusted", headers=h)
    assert client.post(f"/api/transfers/{t['id']}/send", headers=h).status_code == 409
    client.post(f"/api/trusted/requests/{t['id']}/decision", headers=auth("mrs.lim"), json={"decision": "ok"})
    assert client.post(f"/api/transfers/{t['id']}/send", headers=h).json()["status"] == "sent"


def test_trusted_timeout_customer_can_still_save(client, auth):
    h = auth("ryan.lim")
    t = create(client, h, "HR Onboarding – J. Wong", "600", {"chatting": True}).json()
    client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO)
    w = client.post(f"/api/transfers/{t['id']}/ask-trusted", headers=h).json()
    assert w["trusted_timeout_at"]
    s = client.post(f"/api/transfers/{t['id']}/save", headers=h, json={"minutes": 1440})
    assert s.json()["status"] == "saved_for_later"


def test_no_trusted_contact(client, auth):
    h = auth("aisha.rahman")
    t = create(client, h, "HR Onboarding – J. Wong", "600", {"chatting": True}).json()
    client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO)
    r = client.post(f"/api/transfers/{t['id']}/ask-trusted", headers=h)
    assert r.status_code == 409 and "Settings" in r.json()["detail"]


def test_trusted_contact_change_takes_24h(client, auth):
    h = auth("ryan.lim")
    r = client.post("/api/me/trusted-contacts", headers=h, json={"contact_username": "daniel.tan", "relationship": "friend"})
    assert r.status_code == 200 and r.json()["is_active"] is False
    lst = client.get("/api/me/trusted-contacts", headers=h).json()["contacts"]
    old = next(c for c in lst if c["contact_username"] == "mrs.lim")
    assert old["is_active"] and old["pending_removal_at"]
    # the old contact still protects the customer during the 24 h
    t = create(client, h, "HR Onboarding – J. Wong", "600", {"chatting": True}).json()
    client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO)
    assert client.post(f"/api/transfers/{t['id']}/ask-trusted", headers=h).json()["trusted_contact_name"] == "Mrs Lim"


def test_first_trusted_contact_immediate(client, auth):
    h = auth("aisha.rahman")
    r = client.post("/api/me/trusted-contacts", headers=h, json={"contact_username": "mrs.lim", "relationship": "sibling"})
    assert r.json()["is_active"] is True


# --- evidence log immutability -----------------------------------------------------------
def test_evidence_log_is_append_only(client, auth):
    h = auth("tan.siewlan")
    create(client, h, "SP Group", "45")
    with db_module.SessionLocal() as s:
        ev = s.scalars(select(EvidenceEvent)).first()
        ev.event_type = "tampered"
        with pytest.raises(EvidenceImmutableError):
            s.commit()
        s.rollback()
        ev = s.scalars(select(EvidenceEvent)).first()
        s.delete(ev)
        with pytest.raises(EvidenceImmutableError):
            s.commit()


def test_no_evidence_mutation_endpoints(client):
    spec = client.get("/openapi.json").json()["paths"]
    assert not any("evidence" in p for p in spec)
    for p, ops in spec.items():
        if "case" in p or "transfer" in p:
            assert not ({"put", "patch", "delete"} & set(ops)), p


def test_balance_changes_only_on_send(client, auth):
    h = auth("tan.siewlan")
    before = balance(client, h)
    t = create(client, h, "MAS Safety Account – Lim K.", "8000", CALL).json()
    client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO)
    client.post(f"/api/transfers/{t['id']}/save", headers=h, json={"minutes": 60})
    client.post(f"/api/transfers/{t['id']}/ask-trusted", headers=h)
    assert balance(client, h) == before
    with db_module.SessionLocal() as s:
        assert s.get(Transfer, t["id"]).status in ("waiting_trusted_contact",)


# --- staff ----------------------------------------------------------------------------------
def test_staff_action_requires_note(client, auth):
    h = auth("tan.siewlan")
    t = create(client, h, "Hospital – NUH Billing", "3200").json()
    r = client.post(f"/api/staff/cases/{t['id']}/actions", headers=auth("staff.anna"), json={"action": "approve", "note": ""})
    assert r.status_code == 422


def test_staff_approve_moves_money_and_audits(client, auth):
    h = auth("tan.siewlan")
    before = Decimal(balance(client, h))
    t = create(client, h, "Hospital – NUH Billing", "3200").json()
    staff = auth("staff.anna")
    r = client.post(f"/api/staff/cases/{t['id']}/actions", headers=staff,
                    json={"action": "approve", "note": "Verified hospital bill reference."}).json()
    assert r["case"]["status"] == "approved_by_staff"
    assert r["case"]["staff_actions"][0]["note"] == "Verified hospital bill reference."
    assert Decimal(balance(client, h)) == before - Decimal("3200")
    assert client.post(f"/api/staff/cases/{t['id']}/actions", headers=staff,
                       json={"action": "approve", "note": "again"}).status_code == 409


def test_staff_call_customer(client, auth):
    h = auth("tan.siewlan")
    t = create(client, h, "Hospital – NUH Billing", "3200").json()
    r = client.post(f"/api/staff/cases/{t['id']}/actions", headers=auth("staff.anna"),
                    json={"action": "call", "note": "Calling to verify."}).json()
    assert r["call"]["status"] == "ringing"
    v = client.get("/api/calls/active", headers=h).json()
    assert v["genuine"] is True
    acc = client.post(f"/api/calls/{r['call']['id']}/accept", headers=h)
    assert acc.json()["status"] == "active"
    fb = client.post(f"/api/calls/{r['call']['id']}/fallback", headers=h, json={"reason": "mic denied"}).json()
    assert fb["mode"] == "text"
    client.post(f"/api/calls/{r['call']['id']}/end", headers=h)
    assert client.get("/api/calls/active", headers=h).json()["genuine"] is False
    assert "call_fallback_text_chat" in events(t["id"])


def test_verify_call_none(client, auth):
    v = client.get("/api/calls/active", headers=auth("ryan.lim")).json()
    assert v == {"genuine": False, "call": None}


def test_summary_and_metrics(client, auth):
    h = auth("tan.siewlan")
    create(client, h, "SP Group", "45")
    t = create(client, h, "MAS Safety Account – Lim K.", "8000", CALL).json()
    client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO)
    client.post(f"/api/transfers/{t['id']}/cancel", headers=h)
    staff = auth("staff.anna")
    s = client.get("/api/staff/summary", headers=staff).json()
    assert s["cancelled"] == 1 and Decimal(s["money_protected"]) == Decimal("8000")
    m = client.get("/api/metrics", headers=staff).json()
    assert m["payments_checked"] == 2 and m["pct_zero_friction"] == 50.0
    assert m["pct_cancelled_after_pause"] == 100.0


# --- messages ---------------------------------------------------------------------------------
def test_message_check_and_report(client, auth):
    h = auth("ryan.lim")
    text = "Selling 2x Coldplay tickets cat 1! PayNow first, no meetup. Call 9123 4567 or see https://concert-tix-sg.shop/a"
    r = client.post("/api/messages/check", headers=h, json={"text": text}).json()
    assert r["verdict"] == "likely_scam"
    assert any(f["key"] == "paynow_first" for f in r["flags"])
    from app.models import MessageCheck
    with db_module.SessionLocal() as s:
        mc = s.get(MessageCheck, r["id"])
        assert "9123" not in mc.text_redacted and "[link: concert-tix-sg.shop]" in mc.text_redacted
    client.post(f"/api/messages/{r['id']}/report", headers=h)
    staff = auth("staff.anna")
    rep = client.get("/api/staff/messages", headers=staff).json()
    assert rep[0]["review_status"] == "pending"
    rv = client.post(f"/api/staff/messages/{r['id']}/review", headers=staff, json={"review_status": "reviewed", "note": "Known ticket scam."})
    assert rv.json()["review_status"] == "reviewed"


def test_genuine_bank_notice(client, auth):
    h = auth("tan.siewlan")
    r = client.post("/api/messages/check", headers=h, json={
        "text": "OCBC: Your monthly statement for March is ready. View it in the OCBC Verify app. We will never ask for your OTP or password."}).json()
    assert r["verdict"] in ("no_signs", "be_careful", "not_sure")
    assert r["verdict"] != "likely_scam"


def test_empty_message_rejected(client, auth):
    assert client.post("/api/messages/check", headers=auth("ryan.lim"), json={"text": "   "}).status_code == 422


# --- no demo shortcuts, config, self-service payees -------------------------------------------
def test_no_demo_shortcuts_exist(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert not any("demo" in p or "skip" in p for p in paths)
    assert client.post("/api/demo/reset").status_code in (404, 405)


def test_public_config_reflects_env(client):
    c = client.get("/api/config").json()
    assert c["save_for_later_options_minutes"] == [60, 360, 1440]
    assert c["trusted_contact_timeout_minutes"] == 1440
    assert c["contact_change_cooling_minutes"] == 1440
    assert "password" not in str(c).lower()


def test_short_timer_options_from_env(client, auth, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "save_for_later_options_minutes", "1,3,5")
    assert client.get("/api/config").json()["save_for_later_options_minutes"] == [1, 3, 5]
    h = auth("tan.siewlan")
    t = create(client, h, "Hospital – NUH Billing", "3200").json()
    client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO)
    assert client.post(f"/api/transfers/{t['id']}/save", headers=h, json={"minutes": 60}).status_code == 422
    s = client.post(f"/api/transfers/{t['id']}/save", headers=h, json={"minutes": 1}).json()
    assert s["status"] == "saved_for_later"
    assert client.post(f"/api/transfers/{t['id']}/send", headers=h).status_code == 409
    backdate(t["id"], "wait_until", 61)
    assert client.post(f"/api/transfers/{t['id']}/send", headers=h).json()["status"] == "sent"


def test_add_payee_starts_new_and_is_scored_as_new(client, auth):
    h = auth("ryan.lim")
    r = client.post("/api/me/payees", headers=h, json={"name": "HR Onboarding – J. Wong 2", "account_ref": "123-456-789"})
    assert r.status_code == 201 and r.json()["is_new"] is True and r.json()["account_ref"] == "123456789"
    pid = r.json()["id"]
    t = client.post("/api/transfers", headers=h, json={"payee_id": pid, "amount": "600",
                                                       "signals": {"chatting": True, "source": "customer_answer"}}).json()
    assert any(x["key"] == "new_payee" for x in t["reasons"])
    assert "signal_source" in events(t["id"])
    p = client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO).json()
    assert p["status"] == "paused"


@pytest.mark.parametrize("body,field", [({"name": "A", "account_ref": "12345678"}, "name"),
                                        ({"name": "Seller", "account_ref": "12"}, "account_ref"),
                                        ({"name": "Seller", "account_ref": "12$45678"}, "account_ref")])
def test_add_payee_validation(client, auth, body, field):
    r = client.post("/api/me/payees", headers=auth("ryan.lim"), json=body)
    assert r.status_code == 422 and r.json()["detail"]["field"] == field


def test_add_payee_duplicate_and_role(client, auth):
    h = auth("ryan.lim")
    client.post("/api/me/payees", headers=h, json={"name": "Seller", "account_ref": "99887766"})
    assert client.post("/api/me/payees", headers=h, json={"name": "Seller2", "account_ref": "99887766"}).status_code == 422
    assert client.post("/api/me/payees", headers=auth("staff.anna"), json={"name": "X Y", "account_ref": "99887766"}).status_code == 403


def test_reset_is_a_cli_script():
    import subprocess
    import sys
    from pathlib import Path

    out = subprocess.run([sys.executable, "-m", "app.seed", "--help-not-a-flag"], cwd=Path(__file__).parents[1],
                         capture_output=True, text=True, env={**__import__("os").environ, "DATABASE_URL": "sqlite://"})
    assert out.returncode == 0 and "--reset" in out.stdout


# --- judge findings ---------------------------------------------------------------------------
BROWSER_NO = {"on_call": False, "recent_call": False, "chatting": False, "screen_sharing": False,
              "available": True, "source": "customer_answer"}


def test_task1_coached_victim_mas_8000_all_no_pauses(client, auth):
    """Browser: the customer says they are NOT on a call and answers No to everything."""
    h = auth("tan.siewlan")
    t = create(client, h, "MAS Safety Account – Lim K.", "8000", BROWSER_NO).json()
    p = client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO).json()
    assert p["status"] == "paused" and p["risk_tier"] == "pause"
    assert any(r["key"] == "override_new_payee_unusual_large" for r in p["reasons"])


def test_task1_scenario2_hospital_bill_still_ask(client, auth):
    h = auth("tan.siewlan")
    t = create(client, h, "Hospital – NUH Billing", "3200", BROWSER_NO).json()
    a = client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO).json()
    assert a["risk_tier"] == "ask" and a["status"] == "checking" and a["next_step"] == "confirm"


def test_task3_trusted_contact_pauses_for_review_never_permanently(client, auth):
    h = auth("ryan.lim")
    before = Decimal(balance(client, h))
    t = create(client, h, "HR Onboarding – J. Wong", "600", {"chatting": True}).json()
    client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO)
    client.post(f"/api/transfers/{t['id']}/ask-trusted", headers=h)
    client.post(f"/api/trusted/requests/{t['id']}/decision", headers=auth("mrs.lim"), json={"decision": "stop"})
    tr = client.get(f"/api/transfers/{t['id']}", headers=h).json()
    assert tr["status"] == "under_staff_review"
    assert client.post(f"/api/transfers/{t['id']}/send", headers=h).status_code == 409  # paused for review
    # never permanent: staff can release it with a note
    r = client.post(f"/api/staff/cases/{t['id']}/actions", headers=auth("staff.anna"),
                    json={"action": "approve", "note": "Spoke to Ryan and the employer; genuine."})
    assert r.json()["case"]["status"] == "approved_by_staff"
    assert Decimal(balance(client, h)) == before - Decimal("600")


def test_task3_customer_can_still_cancel_while_under_review(client, auth):
    h = auth("ryan.lim")
    t = create(client, h, "HR Onboarding – J. Wong", "600", {"chatting": True}).json()
    client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO)
    client.post(f"/api/transfers/{t['id']}/ask-trusted", headers=h)
    client.post(f"/api/trusted/requests/{t['id']}/decision", headers=auth("mrs.lim"), json={"decision": "stop"})
    assert client.post(f"/api/transfers/{t['id']}/cancel", headers=h).json()["status"] == "cancelled"


# --- Task 4: family code word -------------------------------------------------------------------
SECRET = "Kopi Peng Uncle"


def _user_row(username):
    from app.models import User
    with db_module.SessionLocal() as s:
        return s.scalar(select(User).where(User.username == username))


def test_task4_customer_sets_code_word_stored_hashed_never_returned(client, auth):
    h = auth("tan.siewlan")
    assert client.get("/api/me/code-word", headers=h).json() == {"is_set": False}
    r = client.put("/api/me/code-word", headers=h, json={"code_word": SECRET})
    assert r.json() == {"is_set": True} and SECRET.lower() not in r.text.lower()
    stored = _user_row("tan.siewlan").family_code_word_hash
    assert stored and stored.startswith("$2") and "kopi" not in stored.lower()
    from app.security import verify_password
    assert verify_password("kopi peng uncle", stored)  # normalised: case and spaces


def test_task4_trusted_contact_can_set_for_their_customer_only(client, auth):
    tan = _user_row("tan.siewlan")
    dan = auth("daniel.tan")
    cust = client.get("/api/trusted/customers", headers=dan).json()
    assert cust == [{"id": tan.id, "display_name": "Mdm Tan Siew Lan", "code_word_is_set": False}]
    assert client.put(f"/api/trusted/customers/{tan.id}/code-word", headers=dan, json={"code_word": SECRET}).status_code == 200
    assert client.put(f"/api/trusted/customers/{tan.id}/code-word", headers=auth("mrs.lim"),
                      json={"code_word": "hacked"}).status_code == 404
    assert client.get("/api/me/code-word", headers=auth("tan.siewlan")).json() == {"is_set": True}


def test_task4_code_word_never_in_logs_console_or_errors(client, auth):
    h = auth("tan.siewlan")
    bad = client.put("/api/me/code-word", headers=h, json={"code_word": "ab"})
    assert bad.status_code == 422 and "ab" not in bad.json()["detail"]["message"]
    client.put("/api/me/code-word", headers=h, json={"code_word": SECRET})
    t = create(client, h, "MAS Safety Account – Lim K.", "8000", CALL).json()
    client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO)
    staff = auth("staff.anna")
    blobs = [client.get(f"/api/staff/cases/{t['id']}", headers=staff).text,
             client.get(f"/api/staff/cases/{t['id']}/referral.json", headers=staff).text,
             client.get("/api/staff/audit", headers=staff).text,
             client.get(f"/api/transfers/{t['id']}", headers=h).text]
    with db_module.SessionLocal() as s:
        blobs += [str(e.detail_json) for e in s.scalars(select(EvidenceEvent))]
    for b in blobs:
        assert "kopi" not in b.lower() and "$2b$" not in b


def test_task4_pause_prompts_code_word_on_live_call(client, auth):
    h = auth("tan.siewlan")
    client.put("/api/me/code-word", headers=h, json={"code_word": SECRET})
    t = create(client, h, "MAS Safety Account – Lim K.", "8000", CALL).json()
    p = client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO).json()
    assert p["status"] == "paused" and p["code_word_prompt"] is True and p["code_word_set"] is True


def test_task4_no_prompt_without_call_or_family_signal(client, auth):
    h = auth("tan.siewlan")
    t = create(client, h, "MAS Safety Account – Lim K.", "8000", BROWSER_NO).json()
    p = client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO).json()
    assert p["status"] == "paused" and p["code_word_prompt"] is False and p["code_word_set"] is False


def test_task4_family_emergency_message_triggers_prompt(client, auth):
    h = auth("tan.siewlan")
    t = create(client, h, "MAS Safety Account – Lim K.", "8000", BROWSER_NO).json()
    client.post(f"/api/transfers/{t['id']}/answers", headers=h, json=ALL_NO)
    m = client.post("/api/messages/check", headers=h, json={
        "text": "Ma, this is my new number, my phone broke. I'm in trouble, please send $8,000 now, don't tell anyone."}).json()
    assert any(f["key"] == "family_new_number" for f in m["flags"])
    client.post(f"/api/messages/{m['id']}/attach", headers=h, json={"transfer_id": t["id"]})
    assert client.get(f"/api/transfers/{t['id']}", headers=h).json()["code_word_prompt"] is True


# --- Task 5: attach a checked message to a case ---------------------------------------------------
TICKET = "Selling Coldplay tickets! PayNow first, no meetup. WhatsApp 9123 4567 or https://tix-sg.shop/pay now"


def test_task5_attach_message_to_case_redacted_in_detail_and_timeline(client, auth):
    h = auth("ryan.lim")
    t = create(client, h, "Carousell Seller – ticketsg88", "300", {"chatting": True}).json()
    m = client.post("/api/messages/check", headers=h, json={"text": TICKET}).json()
    r = client.post(f"/api/messages/{m['id']}/attach", headers=h, json={"transfer_id": t["id"]})
    assert r.status_code == 200
    assert client.post(f"/api/messages/{m['id']}/attach", headers=h, json={"transfer_id": t["id"]}).status_code == 409
    d = client.get(f"/api/staff/cases/{t['id']}", headers=auth("staff.anna")).json()
    att = d["attached_messages"]
    assert len(att) == 1 and att[0]["verdict"] == "likely_scam"
    assert "9123" not in att[0]["text_redacted"] and "[link: tix-sg.shop]" in att[0]["text_redacted"]
    ev = [e for e in d["evidence"] if e["event_type"] == "message_attached"]
    assert ev and "9123" not in str(ev[0]["detail"]) and ev[0]["detail"]["message_check_id"] == m["id"]
    # attaching also reports it to staff
    assert any(x["id"] == m["id"] for x in client.get("/api/staff/messages", headers=auth("staff.anna")).json())


def test_task5_cannot_attach_to_someone_elses_payment(client, auth):
    tan = auth("tan.siewlan")
    t = create(client, tan, "SP Group", "45").json()
    ryan = auth("ryan.lim")
    m = client.post("/api/messages/check", headers=ryan, json={"text": TICKET}).json()
    assert client.post(f"/api/messages/{m['id']}/attach", headers=ryan, json={"transfer_id": t["id"]}).status_code == 404
    assert client.post(f"/api/messages/{m['id']}/attach", headers=tan, json={"transfer_id": t["id"]}).status_code == 404


# --- Task 6: payee reported by other customers --------------------------------------------------
def test_task6_payee_reported_by_other_customer_adds_signal(client, auth):
    ryan = auth("ryan.lim")
    t = create(client, ryan, "HR Onboarding – J. Wong", "600", {"chatting": True}).json()
    m = client.post("/api/messages/check", headers=ryan, json={
        "text": "HR Onboarding: you're hired! Pay an upfront training fee of $600 before your first day. Telegram us now."}).json()
    client.post(f"/api/messages/{m['id']}/attach", headers=ryan, json={"transfer_id": t["id"]})
    # Aisha pays the SAME account (shared mule account), small amount, no call
    aisha = auth("aisha.rahman")
    t2 = create(client, aisha, "HR Onboarding – J. Wong", "50", BROWSER_NO).json()
    assert t2["payee_reported"] is True
    assert any(r["key"] == "payee_reported" and r["text"] == "This account was reported by other customers."
               for r in t2["reasons"])
    p = client.post(f"/api/transfers/{t2['id']}/answers", headers=aisha, json=ALL_NO).json()
    assert p["status"] == "paused"  # new payee 2 + reported 4 = 6
    row = next(c for c in client.get("/api/staff/cases", headers=auth("staff.anna")).json() if c["id"] == t2["id"])
    assert row["payee_reported"] is True


def test_task6_escalated_case_counts_as_report_but_own_reports_do_not(client, auth):
    tan = auth("tan.siewlan")
    t = create(client, tan, "MAS Safety Account – Lim K.", "8000", CALL).json()
    client.post(f"/api/transfers/{t['id']}/answers", headers=tan, json=ALL_NO)
    client.post(f"/api/staff/cases/{t['id']}/actions", headers=auth("staff.anna"),
                json={"action": "escalate", "note": "MAS impersonation."})
    again = create(client, tan, "MAS Safety Account – Lim K.", "20", BROWSER_NO).json()
    assert again["payee_reported"] is False  # her own case is not "other customers"
    ryan = create(client, auth("ryan.lim"), "MAS Safety Account – Lim K.", "20", BROWSER_NO).json()
    assert ryan["payee_reported"] is True


def test_task6_unrelated_account_not_reported(client, auth):
    t = create(client, auth("aisha.rahman"), "Hospital – NUH Billing", "50", BROWSER_NO).json()
    assert t["payee_reported"] is False
