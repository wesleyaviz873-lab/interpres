"""Small in-memory rate limiter for login attempts.

This is deliberately simple for the first release (single process). When the
project grows to multiple workers, move the counters to the database or Redis.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, key: str, now: float) -> None:
        cutoff = now - self.window_seconds
        hits = self._hits[key]
        while hits and hits[0] < cutoff:
            hits.popleft()
        if not hits:
            self._hits.pop(key, None)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        self._prune(key, now)
        return len(self._hits.get(key, ())) < self.max_attempts

    def hit(self, key: str) -> None:
        now = time.monotonic()
        self._prune(key, now)
        self._hits[key].append(now)

    def reset(self, key: str) -> None:
        self._hits.pop(key, None)

    def clear(self) -> None:
        self._hits.clear()
