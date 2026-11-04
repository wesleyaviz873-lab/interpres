"""Interpres API entry point."""

from __future__ import annotations

import base64
import hashlib
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import Base, engine
from .routes import (
    agents,
    auth,
    chat,
    conversations,
    harnesses,
    health,
    projects,
    providers,
    screenshots,
    system_memory as system_memory_routes,
    transcribe,
    tunnel,
    uploads,
)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.workspace_dir.mkdir(parents=True, exist_ok=True)
    # Development convenience. Production runs `alembic upgrade head` in the
    # container entrypoint before uvicorn starts.
    if not settings.is_production:
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Interpres API",
    version="0.2.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/api/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/api/openapi.json",
)


_SCRIPT_HASH_CACHE: dict[str, object] = {"mtime": None, "value": None}


def _inline_script_hash() -> str | None:
    index = Path(settings.web_dist_dir) / "index.html"
    try:
        mtime = index.stat().st_mtime
    except OSError:
        return None
    if _SCRIPT_HASH_CACHE["mtime"] == mtime:
        return _SCRIPT_HASH_CACHE["value"]  # type: ignore[return-value]
    try:
        html = index.read_text(encoding="utf-8")
    except OSError:
        return None
    match = re.search(r'<script type="module">(.*?)</script>', html, re.S)
    value = None
    if match:
        digest = hashlib.sha256(match.group(1).encode("utf-8")).digest()
        value = "sha256-" + base64.b64encode(digest).decode("ascii")
    _SCRIPT_HASH_CACHE["mtime"] = mtime
    _SCRIPT_HASH_CACHE["value"] = value
    return value


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(self), camera=()")
    script_src = "script-src 'self'"
    script_hash = _inline_script_hash()
    if script_hash:
        script_src += f" '{script_hash}'"
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
        f"{script_src}; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'",
    )
    if settings.is_production:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    if request.url.path.startswith("/assets/"):
        response.headers.setdefault("Cache-Control", "public, max-age=31536000, immutable")
    if request.url.path == "/" or request.url.path.endswith("index.html"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Cloudflare-CDN-Cache-Control"] = "no-store"
    return response


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(providers.router)
app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(projects.router)
app.include_router(uploads.router)
app.include_router(transcribe.router)
app.include_router(screenshots.router)
app.include_router(system_memory_routes.router)
app.include_router(agents.router)
app.include_router(tunnel.router)
app.include_router(harnesses.router)


_web_dist = Path(settings.web_dist_dir)
if _web_dist.exists():
    app.mount("/", StaticFiles(directory=str(_web_dist), html=True), name="web")


