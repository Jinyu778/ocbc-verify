"""Public, read-only configuration. Values come from .env and are shown as-is in the app."""

from fastapi import APIRouter

from ..config import get_settings

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config")
def public_config():
    s = get_settings()
    return {
        "save_for_later_options_minutes": s.save_options,
        "trusted_contact_timeout_minutes": s.trusted_contact_timeout_minutes,
        "contact_change_cooling_minutes": s.contact_change_cooling_minutes,
        "continue_anyway_seconds": s.continue_anyway_seconds,
        "hang_up_wait_minutes": s.hang_up_wait_minutes,
    }
