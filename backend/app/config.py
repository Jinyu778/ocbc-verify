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
    demo_mode: bool = True
    # Trusted-contact reply window. Demo: 120 s. Real deployment: 86400 s (24 h).
    trusted_timeout_seconds: int = 120
    continue_anyway_seconds: int = 30
    contact_change_hours: int = 24
    cors_origins: str = "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,capacitor://localhost,http://localhost"
    turn_url: str = ""
    turn_username: str = ""
    turn_credential: str = ""
    login_max_failures: int = 5
    login_window_seconds: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
