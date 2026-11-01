"""Short-lived bearer tokens used by harness tool commands."""

from __future__ import annotations

import secrets
import threading
import time

_LOCK = threading.Lock()
_TOKENS: dict[str, dict[str, object]] = {}
_TTL = 1800


def _prune(now: float) -> None:
    for token in [key for key, data in _TOKENS.items() if float(data["expires"]) < now]:
        _TOKENS.pop(token, None)


def create(conversation_id: str, user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    now = time.time()
    with _LOCK:
        _prune(now)
        _TOKENS[token] = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "expires": now + _TTL,
        }
    return token


def resolve(token: str) -> dict[str, object] | None:
    if not token:
        return None
    now = time.time()
    with _LOCK:
        _prune(now)
        data = _TOKENS.get(token)
        if not data:
            return None
        return dict(data)
