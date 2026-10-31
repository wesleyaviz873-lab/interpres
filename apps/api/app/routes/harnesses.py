"""Harness installation, toggle and execution."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import audit, require_csrf, require_user
from ..config import settings
from ..crypto import decrypt_secret
from ..database import get_db
from ..harnesses import (
    HARNESSES,
    binary_path,
    install,
    is_installed,
    run_harness,
    test_harness,
)
from ..models import HarnessSetting, ProviderKey, User, utcnow

router = APIRouter(prefix="/api/harnesses", tags=["harnesses"])


class ToggleRequest(BaseModel):
    enabled: bool


class RunRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=50000)
    cwd: str | None = Field(default=None, max_length=2000)


def _setting(db: Session, harness_id: str) -> HarnessSetting:
    setting = db.get(HarnessSetting, harness_id)
    if not setting:
        setting = HarnessSetting(id=harness_id, enabled=False)
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


def _item(db: Session, harness_id: str) -> dict[str, object]:
    spec = HARNESSES[harness_id]
    setting = _setting(db, harness_id)
    installed = is_installed(harness_id)
    return {
        "id": harness_id,
        "name": spec["name"],
        "description": spec["description"],
        "package": spec["package"],
        "installed": installed,
        "enabled": bool(setting.enabled and installed),
        "selected": bool(setting.selected and installed),
    }


def _validate(harness_id: str) -> str:
    if harness_id not in HARNESSES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Harness desconhecido.")
    return harness_id


def _workspace(raw: str | None) -> Path:
    root = settings.workspace_dir.resolve()
    target = Path(raw).resolve() if raw else root
    if target != root and root not in target.parents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A pasta precisa estar dentro do workspace.",
        )
    target.mkdir(parents=True, exist_ok=True)
    return target


def _provider_env(db: Session) -> dict[str, str]:
    mapping = {
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "google": "GEMINI_API_KEY",
        "openrouter": "OPENROUTER_API_KEY",
    }
    env: dict[str, str] = {}
    for row in db.scalars(select(ProviderKey)).all():
        key = mapping.get(row.provider)
        if not key:
            continue
        try:
            env[key] = decrypt_secret(row.encrypted_value)
        except Exception:
            continue
    return env


@router.get("")
def list_harnesses(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    items = [_item(db, harness_id) for harness_id in HARNESSES]
    selected = next((item["id"] for item in items if item["selected"]), None)
    return {"harnesses": items, "selected": selected}


@router.post("/{harness_id}/install")
def install_harness(
    harness_id: str,
    request: Request,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    harness_id = _validate(harness_id)
    setting = _setting(db, harness_id)
    ok, detail = install(harness_id)
    if not ok:
        setting.last_error = detail[:1000]
        db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail or "Falha ao instalar.")
    setting.installed_at = utcnow()
    setting.last_error = None
    db.commit()
    audit(db, "harness.installed", user.id, request, harness_id)
    return _item(db, harness_id)


@router.post("/{harness_id}/toggle")
def toggle_harness(
    harness_id: str,
    body: ToggleRequest,
    request: Request,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    harness_id = _validate(harness_id)
    setting = _setting(db, harness_id)
    if body.enabled and not is_installed(harness_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Baixe o harness antes de ativar.",
        )
    if body.enabled:
        for row in db.scalars(select(HarnessSetting)).all():
            row.enabled = False
            row.selected = False
        setting.enabled = True
        setting.selected = True
    else:
        setting.enabled = False
        setting.selected = False
    db.commit()
    audit(db, "harness.enabled" if body.enabled else "harness.disabled", user.id, request, harness_id)
    return _item(db, harness_id)


@router.post("/{harness_id}/select")
def select_harness(
    harness_id: str,
    request: Request,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    harness_id = _validate(harness_id)
    if not is_installed(harness_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Instale o harness antes de usá-lo no chat.",
        )
    for row in db.scalars(select(HarnessSetting)).all():
        row.selected = row.id == harness_id
    setting = _setting(db, harness_id)
    setting.selected = True
    setting.enabled = True
    db.commit()
    audit(db, "harness.selected", user.id, request, harness_id)
    return _item(db, harness_id)


@router.post("/{harness_id}/deselect")
def deselect_harness(
    harness_id: str,
    request: Request,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    harness_id = _validate(harness_id)
    setting = _setting(db, harness_id)
    setting.selected = False
    db.commit()
    audit(db, "harness.deselected", user.id, request, harness_id)
    return _item(db, harness_id)


@router.post("/{harness_id}/test")
def test_installed_harness(
    harness_id: str,
    user: User = Depends(require_user),
) -> dict[str, object]:
    harness_id = _validate(harness_id)
    if not is_installed(harness_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Harness não instalado.")
    return test_harness(harness_id)


@router.post("/{harness_id}/run")
def run_installed_harness(
    harness_id: str,
    body: RunRequest,
    request: Request,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    harness_id = _validate(harness_id)
    setting = _setting(db, harness_id)
    if not is_installed(harness_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Harness não instalado.")
    if not setting.enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ative o harness antes de usar.")
    cwd = _workspace(body.cwd)
    result = run_harness(harness_id, body.prompt, cwd, _provider_env(db))
    audit(db, "harness.run", user.id, request, harness_id)
    return result
