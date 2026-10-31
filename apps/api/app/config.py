"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_url: str = "http://localhost:3000"
    app_secret: str = "dev-only-change-me"
    app_env: str = "development"
    app_mode: str = "local"
    database_url: str = "sqlite:///./data/interpres.db"
    workspace_dir: Path = Path("./workspace")
    data_dir: Path = Path("./data")
    web_dist_dir: Path = Path("./apps/web/dist")
    session_ttl_hours: int = 720
    auth_max_attempts: int = 10
    auth_window_minutes: int = 15
    allow_signup: bool = False

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_security: str = "starttls"  # starttls | ssl | none
    ollama_base_url: str = "http://localhost:11434"

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def is_local_mode(self) -> bool:
        return self.app_mode.lower() != "server"

    @property
    def cookie_secure(self) -> bool:
        return self.app_url.lower().startswith("https://")

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host.strip() and self.smtp_from.strip())

    @model_validator(mode="after")
    def _validate_production_secret(self) -> "Settings":
        insecure = {"", "change-me", "dev-only-change-me"}
        if self.is_production and (self.app_secret in insecure or len(self.app_secret) < 32):
            raise ValueError(
                "APP_SECRET must be a random value with at least 32 characters in production."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
