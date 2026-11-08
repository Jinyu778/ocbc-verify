from fastapi import APIRouter, HTTPException

from ..config import get_settings
from ..realtime import hub
from ..security import reset_rate_limits
from ..seed import DEMO_PASSWORD, reset_database

router = APIRouter(prefix="/api", tags=["demo"])


@router.get("/config")
def public_config():
    s = get_settings()
    out = {
        "demo_mode": s.demo_mode,
        "trusted_timeout_seconds": s.trusted_timeout_seconds,
        "continue_anyway_seconds": s.continue_anyway_seconds,
        "contact_change_hours": s.contact_change_hours,
    }
    if s.demo_mode:
        out["demo_password"] = DEMO_PASSWORD
    return out


@router.post("/demo/reset")
def demo_reset():
    if not get_settings().demo_mode:
        raise HTTPException(404, "Not found")
    reset_database()
    reset_rate_limits()
    hub.notify({"type": "demo.reset"}, user_ids=list(hub.users.keys()), staff=True)
    return {"ok": True}
