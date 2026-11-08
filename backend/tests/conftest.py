import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SAVE_FOR_LATER_OPTIONS_MINUTES"] = "60,360,1440"
os.environ["TRUSTED_CONTACT_TIMEOUT_MINUTES"] = "1440"
os.environ["CONTACT_CHANGE_COOLING_MINUTES"] = "1440"
os.environ["JWT_SECRET"] = "test-secret"

from datetime import timedelta  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import db as db_module  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Transfer  # noqa: E402
from app.security import reset_rate_limits  # noqa: E402
from app.seed import TEST_PASSWORD, reset_database  # noqa: E402


@pytest.fixture()
def client():
    reset_database()
    reset_rate_limits()
    with TestClient(app) as c:
        yield c


def login(client, username):
    r = client.post("/api/auth/login", json={"username": username, "password": TEST_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def auth(client):
    return lambda username: login(client, username)


def payee_id(client, headers, name):
    for p in client.get("/api/me/payees", headers=headers).json():
        if p["name"] == name:
            return p["id"]
    raise AssertionError(f"payee {name} not found")


def balance(client, headers):
    return client.get("/api/me/account", headers=headers).json()["balance"]


def backdate(transfer_id, field, seconds):
    """Move a timestamp into the past (simulates time passing)."""
    with db_module.SessionLocal() as s:
        t = s.get(Transfer, transfer_id)
        setattr(t, field, getattr(t, field) - timedelta(seconds=seconds))
        s.commit()
