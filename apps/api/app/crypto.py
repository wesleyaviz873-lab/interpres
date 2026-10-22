"""Small helpers for secrets that must not be stored in plain text."""

from __future__ import annotations

import base64
import hashlib
import hmac

from cryptography.fernet import Fernet

from .config import settings
from .security import normalize_backup_code


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.app_secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(value: str) -> str:
    return _fernet().decrypt(value.encode("ascii")).decode("utf-8")


def hash_backup_code(code: str) -> str:
    normalized = normalize_backup_code(code)
    return hmac.new(
        settings.app_secret.encode("utf-8"),
        normalized.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
