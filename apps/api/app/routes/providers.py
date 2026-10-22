"""Provider keys and local Ollama discovery."""

from __future__ import annotations

import json
import logging
from urllib.parse import urlparse
from urllib.request import urlopen

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import audit, require_csrf, require_user
from ..config import settings
from ..crypto import decrypt_secret, encrypt_secret
from ..database import get_db
from ..models import ProviderKey, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/providers", tags=["providers"])

PROVIDERS: dict[str, dict[str, object]] = {
    "openai": {"label": "OpenAI", "placeholder": "sk-..."},
    "anthropic": {"label": "Anthropic", "placeholder": "sk-ant-..."},
    "google": {"label": "Google AI (Gemini)", "placeholder": "AIza..."},
    "openrouter": {"label": "OpenRouter", "placeholder": "sk-or-..."},
    "opencode": {"label": "OpenCode", "placeholder": "oc-sk-..."},
    "ollama": {"label": "Ollama (URL local)", "placeholder": "http://localhost:11434"},
}

OLLAMA_DEFAULT = settings.ollama_base_url


class ProviderKeyRequest(BaseModel):
    value: str = Field(min_length=1, max_length=2000)


def _validate_provider(provider: str) -> str:
    key = provider.strip().lower()
    if key not in PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provedor desconhecido.")
    return key


def _validate_value(provider: str, value: str) -> str:
    clean = value.strip()
    if not clean:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe um valor.")
    if provider == "ollama":
        parsed = urlparse(clean)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Use uma URL http:// ou https:// válida para o Ollama.",
            )
    return clean


def _ollama_base_url(db: Session) -> str:
    row = db.get(ProviderKey, "ollama")
    if not row:
        return OLLAMA_DEFAULT
    try:
        return decrypt_secret(row.encrypted_value)
    except Exception:
        logger.warning("Não consegui decifrar a URL do Ollama; usando o padrão.")
        return OLLAMA_DEFAULT


@router.get("")
def list_providers(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    configured = {row.provider for row in db.scalars(select(ProviderKey)).all()}
    return {
        "providers": [
            {
                "id": provider,
                "label": config["label"],
                "placeholder": config["placeholder"],
                "configured": provider in configured,
                "hint": (
                    _ollama_base_url(db)
                    if provider == "ollama" and provider in configured
                    else ("Configurada" if provider in configured else "")
                ),
            }
            for provider, config in PROVIDERS.items()
        ]
    }


@router.put("/{provider}")
def save_provider_key(
    provider: str,
    body: ProviderKeyRequest,
    request: Request,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    key = _validate_provider(provider)
    value = _validate_value(key, body.value)
    row = db.get(ProviderKey, key)
    if row:
        row.encrypted_value = encrypt_secret(value)
    else:
        db.add(ProviderKey(provider=key, encrypted_value=encrypt_secret(value)))
    db.commit()
    audit(db, "provider.key_saved", user.id, request, key)
    return {"ok": True}


@router.delete("/{provider}")
def delete_provider_key(
    provider: str,
    request: Request,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    key = _validate_provider(provider)
    row = db.get(ProviderKey, key)
    if row:
        db.delete(row)
        db.commit()
        audit(db, "provider.key_deleted", user.id, request, key)
    return {"ok": True}


@router.get("/ollama/models")
def ollama_models(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    base_url = _ollama_base_url(db).rstrip("/")
    try:
        with urlopen(f"{base_url}/api/tags", timeout=4) as response:
            data = json.loads(response.read().decode("utf-8"))
        models = [
            str(item.get("name"))
            for item in data.get("models", [])
            if isinstance(item, dict) and item.get("name")
        ]
        return {"reachable": True, "base_url": base_url, "models": models}
    except Exception as exc:  # noqa: BLE001 - best-effort local discovery
        logger.info("Ollama indisponível em %s: %s", base_url, exc)
        return {
            "reachable": False,
            "base_url": base_url,
            "models": [],
            "error": "Ollama não respondeu.",
        }
