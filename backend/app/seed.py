"""Synthetic test accounts and data. Nothing here is a real person or account.

Reset from the command line only:  python -m app.seed --reset
"""

from __future__ import annotations

import random
import statistics
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from . import db as db_module
from .db import Base
from .models import Account, Payee, Transfer, TrustedContact, User
from .security import hash_password

TEST_PASSWORD = "Test1234!"  # listed in the README only; never shown in the app

USERS = [
    dict(username="tan.siewlan", role="customer", display_name="Mdm Tan Siew Lan", age=68,
         preferred_language="zh", easy_mode=True, balance="42000.00", phone_masked="+65 9••• ••21"),
    dict(username="ryan.lim", role="customer", display_name="Ryan Lim", age=21,
         preferred_language="en", easy_mode=False, balance="2800.00", phone_masked="+65 8••• ••47"),
    dict(username="aisha.rahman", role="customer", display_name="Aisha Rahman", age=41,
         preferred_language="ms", easy_mode=False, balance="15500.00", phone_masked="+65 9••• ••03"),
    dict(username="daniel.tan", role="trusted_contact", display_name="Daniel Tan", age=40,
         preferred_language="en", easy_mode=False, phone_masked="+65 9••• ••88"),
    dict(username="mrs.lim", role="trusted_contact", display_name="Mrs Lim", age=50,
         preferred_language="en", easy_mode=False, phone_masked="+65 9••• ••12"),
    dict(username="staff.anna", role="staff", display_name="Anna Koh", age=None,
         preferred_language="en", easy_mode=False),
]

KNOWN_PAYEES = {
    "tan.siewlan": [("Tan Wei Ming (son)", (150, 600)), ("SP Group", (60, 140)), ("Town Council S&CC", (60, 90))],
    "ryan.lim": [("Mrs Lim (mother)", (20, 80)), ("SP Group", (20, 60))],
    "aisha.rahman": [("SP Group", (90, 220)), ("Town Council S&CC", (70, 110))],
}
NEW_PAYEES = [
    "MAS Safety Account – Lim K.",
    "Hospital – NUH Billing",
    "HR Onboarding – J. Wong",
    "Carousell Seller – ticketsg88",
]
NEW_PAYEE_ACCOUNTS = {
    "MAS Safety Account – Lim K.": "SB-7731-0042",
    "Hospital – NUH Billing": "SB-2210-5180",
    "HR Onboarding – J. Wong": "SB-5501-2233",
    "Carousell Seller – ticketsg88": "SB-8864-1907",
}
TRUSTED = [("tan.siewlan", "daniel.tan", "child"), ("ryan.lim", "mrs.lim", "parent")]


def _money(x: float) -> Decimal:
    return Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def seed(db: Session, rng_seed: int = 2026) -> None:
    rng = random.Random(rng_seed)
    now = datetime.now(timezone.utc)
    pw = hash_password(TEST_PASSWORD)
    users: dict[str, User] = {}
    for spec in USERS:
        spec = dict(spec)
        balance = spec.pop("balance", None)
        u = User(password_hash=pw, **spec)
        db.add(u)
        db.flush()
        users[u.username] = u
        if balance is not None:
            db.add(Account(user_id=u.id, balance=Decimal(balance)))
    db.flush()

    for username, known in KNOWN_PAYEES.items():
        owner = users[username]
        amounts: list[float] = []
        for i, (name, (lo, hi)) in enumerate(known):
            p = Payee(owner_user_id=owner.id, name=name, account_ref=f"SB-{owner.id:02d}{i:02d}-{rng.randint(1000, 9999)}",
                      first_added_at=now - timedelta(days=400))
            db.add(p)
            db.flush()
            # ~6 months of normal history: one or two payments a month per known payee
            for m in range(6):
                for _ in range(rng.choice([1, 1, 2])):
                    amt = _money(rng.uniform(lo, hi))
                    amounts.append(float(amt))
                    when = now - timedelta(days=30 * m + rng.randint(1, 28), hours=rng.randint(0, 12))
                    db.add(Transfer(customer_user_id=owner.id, payee_id=p.id, amount=amt, status="sent",
                                    risk_tier="none", risk_score=0, signals_json={}, reasons_json=[],
                                    is_seed_history=True, created_at=when, updated_at=when, completed_at=when))
        for j, name in enumerate(NEW_PAYEES):
            # Same account number for every customer: scam "mule" accounts are shared across
            # victims, which is what makes "reported by other customers" possible.
            db.add(Payee(owner_user_id=owner.id, name=name, account_ref=NEW_PAYEE_ACCOUNTS[name],
                         first_added_at=now - timedelta(days=rng.randint(0, 2))))
        acct = owner.account or db.query(Account).filter_by(user_id=owner.id).one()
        acct.typical_transfer_mean = _money(statistics.mean(amounts))
        acct.typical_transfer_std = _money(statistics.pstdev(amounts))

    for cust, contact, rel in TRUSTED:
        db.add(TrustedContact(customer_user_id=users[cust].id, contact_user_id=users[contact].id,
                              relationship_type=rel, active_from=now - timedelta(days=30)))
    db.commit()


def reset_database() -> None:
    Base.metadata.drop_all(bind=db_module.engine)
    Base.metadata.create_all(bind=db_module.engine)
    with db_module.SessionLocal() as s:
        seed(s)


def _upgrade_dev_db() -> None:
    """Dev databases made by create_all (not Alembic) get the columns added in migrations 0002 and 0003."""
    from sqlalchemy import inspect, text

    insp = inspect(db_module.engine)
    user_cols = {c["name"] for c in insp.get_columns("users")}
    transfer_cols = {c["name"] for c in insp.get_columns("transfers")}
    with db_module.engine.begin() as conn:
        if "family_code_word_hash" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN family_code_word_hash VARCHAR(128)"))
        if "call_ended_at" not in transfer_cols:
            conn.execute(text("ALTER TABLE transfers ADD COLUMN call_ended_at TIMESTAMP"))


def ensure_seeded() -> None:
    Base.metadata.create_all(bind=db_module.engine)
    _upgrade_dev_db()
    with db_module.SessionLocal() as s:
        if s.query(User).count() == 0:
            seed(s)


if __name__ == "__main__":
    import sys

    if "--reset" in sys.argv:
        reset_database()
        print("Database wiped and re-seeded with the test accounts.")
    else:
        ensure_seeded()
        print("Database ready (seeded only if empty). Use --reset to wipe and re-seed.")
