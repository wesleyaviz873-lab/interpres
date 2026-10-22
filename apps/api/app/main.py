"""Interpres API entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import Base, engine
from .routes import agents, auth, health, providers


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
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/api/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/api/openapi.json",
)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
        "script-src 'self'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'",
    )
    if settings.is_production:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    if request.url.path == "/" or request.url.path.endswith("index.html"):
        response.headers["Cache-Control"] = "no-store"
    return response


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(providers.router)
app.include_router(agents.router)


_web_dist = Path(settings.web_dist_dir)
if _web_dist.exists():
    app.mount("/", StaticFiles(directory=str(_web_dist), html=True), name="web")
