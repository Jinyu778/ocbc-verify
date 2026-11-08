from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(BACKEND_DIR.parent / ".env", BACKEND_DIR / ".env"), extra="ignore")

    database_url: str = f"sqlite:///{(BACKEND_DIR / 'safebank.db').as_posix()}"
    jwt_secret: str = "dev-only-change-me"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    # Test-environment knobs (no buttons in the UI). Testers may shorten them, e.g. "1,3,5".
    save_for_later_options_minutes: str = "60,360,1440"
    trusted_contact_timeout_minutes: int = 1440
    contact_change_cooling_minutes: int = 1440
    continue_anyway_seconds: int = 30
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,capacitor://localhost,http://localhost"
    turn_url: str = ""
    turn_username: str = ""
    turn_credential: str = ""
    login_max_failures: int = 5
    login_window_seconds: int = 60

    @property
    def save_options(self) -> list[int]:
        out = sorted({int(x) for x in self.save_for_later_options_minutes.split(",") if x.strip().isdigit() and int(x) > 0})
        return out or [60, 360, 1440]


@lru_cache
def get_settings() -> Settings:
    return Settings()
