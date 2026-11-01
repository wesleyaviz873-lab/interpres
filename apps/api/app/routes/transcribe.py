"""Audio transcription through the OpenAI provider."""

from __future__ import annotations

import logging

import requests
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..auth import require_csrf
from ..crypto import decrypt_secret
from ..database import get_db
from ..models import ProviderKey, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transcribe", tags=["voice"])

MAX_BYTES = 20 * 1024 * 1024
OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions"


@router.post("")
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    row = db.get(ProviderKey, "openai")
    if not row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configure a chave OpenAI em Configurações → Chaves de API para transcrever.",
        )
    try:
        api_key = decrypt_secret(row.encrypted_value)
    except Exception as exc:  # noqa: BLE001 - never leak the stored value
        logger.warning("Nao consegui decifrar a chave OpenAI: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não foi possível ler a chave salva.",
        ) from exc

    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Áudio vazio.")
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="O áudio passa de 20 MB.",
        )

    form = {"model": "whisper-1", "response_format": "json"}
    if language and len(language) >= 2:
        form["language"] = language.split("-")[0]

    try:
        response = requests.post(
            OPENAI_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": (file.filename or "audio.webm", data, file.content_type or "audio/webm")},
            data=form,
            timeout=120,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha ao falar com a OpenAI: {exc}",
        ) from exc

    if response.status_code >= 400:
        detail = response.text[:400]
        if response.status_code in (401, 403):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Chave OpenAI inválida ou sem acesso à transcrição.",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI recusou a transcrição ({response.status_code}): {detail}",
        )

    try:
        text = str(response.json().get("text") or "").strip()
    except ValueError:
        text = response.text.strip()

    if not text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="A transcrição voltou vazia.",
        )
    return {"text": text}
