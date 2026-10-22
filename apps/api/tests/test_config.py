from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.config import Settings


def test_production_rejects_default_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(app_env="production", app_secret="change-me")


def test_production_rejects_short_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(app_env="production", app_secret="short")


def test_production_accepts_random_secret() -> None:
    settings = Settings(app_env="production", app_secret="a" * 64)
    assert settings.is_production
    assert settings.cookie_secure is False


def test_https_url_marks_cookie_secure() -> None:
    settings = Settings(app_env="development", app_url="https://interpres.example.com")
    assert settings.cookie_secure is True
