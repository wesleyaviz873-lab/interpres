"""Tunnel control endpoints for the owner."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from ..auth import audit, require_csrf, require_user
from ..database import get_db
from ..models import User
from ..tunnel import PROVIDERS, tunnel_manager
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/tunnel", tags=["tunnel"])


class TunnelStartRequest(BaseModel):
    provider: str = Field(min_length=1, max_length=40)
    token: str | None = Field(default=None, max_length=2000)


@router.get("/status")
def tunnel_status(user: User = Depends(require_user)) -> dict[str, object]:
    return {**tunnel_manager.status(), "providers": PROVIDERS}


@router.post("/start")
def tunnel_start(
    body: TunnelStartRequest,
    request: Request,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    result = tunnel_manager.start(body.provider, body.token)
    if not result.get("ok"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(result.get("error") or "Não foi possível iniciar o túnel."),
        )
    audit(db, "tunnel.started", user.id, request, body.provider)
    return result


@router.post("/stop")
def tunnel_stop(
    request: Request,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    tunnel_manager.stop()
    audit(db, "tunnel.stopped", user.id, request)
    return {"ok": True}
