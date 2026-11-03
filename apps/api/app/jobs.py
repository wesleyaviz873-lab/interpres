"""In-memory chat jobs with a live log streamed to the UI."""

from __future__ import annotations

import threading
import time
import uuid

_LOCK = threading.Lock()
_JOBS: dict[str, dict[str, object]] = {}
_MAX_JOBS = 60
_TTL_SECONDS = 86400
_MAX_LINES = 800


def _prune() -> None:
    now = time.time()
    expired = [
        job_id
        for job_id, job in _JOBS.items()
        if now - float(job.get("created", now)) > _TTL_SECONDS
    ]
    for job_id in expired:
        _JOBS.pop(job_id, None)
    if len(_JOBS) > _MAX_JOBS:
        for job_id, _ in sorted(
            _JOBS.items(), key=lambda item: float(item[1].get("created", 0))
        )[: len(_JOBS) - _MAX_JOBS]:
            _JOBS.pop(job_id, None)


def create(user_id: str) -> str:
    job_id = uuid.uuid4().hex
    with _LOCK:
        _prune()
        _JOBS[job_id] = {
            "user_id": user_id,
            "status": "running",
            "log": [],
            "result": None,
            "error": None,
            "created": time.time(),
            "updated": time.time(),
            "cancel": threading.Event(),
        }
    return job_id


def append(job_id: str, line: str) -> None:
    text = " ".join(str(line).split())
    if not text:
        return
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return
        log = job["log"]
        assert isinstance(log, list)
        log.append(text[:600])
        if len(log) > _MAX_LINES:
            del log[: len(log) - _MAX_LINES]
        job["updated"] = time.time()


def finish(job_id: str, result: dict[str, object]) -> None:
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return
        job["status"] = "done"
        job["result"] = result
        job["updated"] = time.time()


def fail(job_id: str, error: str) -> None:
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return
        job["status"] = "error"
        job["error"] = str(error)[:1000]
        job["updated"] = time.time()


def cancel(job_id: str, user_id: str) -> bool:
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job or job.get("user_id") != user_id:
            return False
        event = job.get("cancel")
        if isinstance(event, threading.Event):
            event.set()
        return True


def cancel_event(job_id: str) -> threading.Event | None:
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return None
        event = job.get("cancel")
        return event if isinstance(event, threading.Event) else None


def get(job_id: str, user_id: str) -> dict[str, object] | None:
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job or job.get("user_id") != user_id:
            return None
        return {
            "status": job["status"],
            "log": list(job.get("log") or []),
            "result": job.get("result"),
            "error": job.get("error"),
        }
