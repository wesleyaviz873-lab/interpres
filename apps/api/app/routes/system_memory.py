"""Memory diagnostics and freeing for harness runs."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .. import system_memory
from ..auth import require_csrf, require_user
from ..models import User

router = APIRouter(prefix="/api/system/memory", tags=["system"])


class FreeRequest(BaseModel):
    targets: list[str] = Field(default_factory=list, max_length=8)


class PolicyRequest(BaseModel):
    auto: bool = False
    threshold_mb: int = Field(default=1500, ge=256, le=16384)
    targets: list[str] = Field(default_factory=list, max_length=8)


@router.get("")
def read_memory(user: User = Depends(require_user)) -> dict[str, object]:
    return system_memory.status()


@router.post("/free")
def free_memory(
    body: FreeRequest,
    user: User = Depends(require_csrf),
) -> dict[str, object]:
    return system_memory.free_memory(body.targets)


@router.post("/restore")
def restore_apps(user: User = Depends(require_csrf)) -> dict[str, object]:
    return system_memory.restore_apps()


@router.get("/policy")
def read_policy(user: User = Depends(require_user)) -> dict[str, object]:
    return system_memory.load_policy()


@router.put("/policy")
def write_policy(
    body: PolicyRequest,
    user: User = Depends(require_csrf),
) -> dict[str, object]:
    return system_memory.save_policy(body.auto, body.threshold_mb, body.targets)
