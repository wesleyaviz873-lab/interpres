"""Screen capture as a conversation attachment and as a harness tool."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import tool_tokens
from ..auth import require_csrf, require_user
from ..config import settings
from ..database import get_db
from ..models import Conversation, ConversationMessage, User, utcnow
from ..screenshots import capture_png
from .conversations import serialize, serialize_message

router = APIRouter(prefix="/api", tags=["screenshots"])

_SAFE_NAME = re.compile(r"^[a-f0-9]{32}\.png$")


class CaptureRequest(BaseModel):
    conversation_id: str | None = Field(default=None, max_length=36)


def _capture_dir() -> Path:
    directory = settings.data_dir.resolve() / "screenshots"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _attach(db: Session, conversation: Conversation, user_id: str) -> ConversationMessage:
    try:
        data = capture_png()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    name = f"{uuid.uuid4().hex}.png"
    (_capture_dir() / name).write_bytes(data)

    message = ConversationMessage(
        conversation_id=conversation.id,
        role="assistant",
        content="Print da tela",
        image=f"/api/screenshots/{name}",
    )
    db.add(message)
    conversation.updated_at = utcnow()
    db.commit()
    db.refresh(message)
    return message


def _own_conversation(db: Session, user: User, conversation_id: str | None) -> Conversation:
    if conversation_id:
        conversation = db.get(Conversation, conversation_id)
        if not conversation or conversation.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Conversa não encontrada."
            )
        return conversation
    conversation = Conversation(user_id=user.id, title="Print da tela")
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.post("/screenshots")
def capture(
    body: CaptureRequest,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    conversation = _own_conversation(db, user, body.conversation_id)
    message = _attach(db, conversation, user.id)
    db.refresh(conversation)
    return {
        "conversation": serialize(conversation, len(conversation.messages)),
        "message": serialize_message(message),
    }


@router.get("/screenshots/{name}")
def read(
    name: str,
    user: User = Depends(require_user),
) -> FileResponse:
    if not _SAFE_NAME.match(name):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imagem não encontrada.")
    path = _capture_dir() / name
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imagem não encontrada.")
    return FileResponse(path, media_type="image/png")


@router.post("/tool/screenshot")
def tool_screenshot(
    request: Request,
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    host = request.client.host if request.client else ""
    if settings.app_env != "test" and host not in {"127.0.0.1", "::1", "localhost"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Uso apenas local.")
    token = authorization[7:] if authorization.lower().startswith("bearer ") else ""
    data = tool_tokens.resolve(token)
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido.")
    conversation = db.get(Conversation, str(data["conversation_id"]))
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversa não encontrada.")
    message = _attach(db, conversation, str(data["user_id"]))
    return {
        "ok": True,
        "image": message.image,
        "message_id": message.id,
        "conversation_id": conversation.id,
    }
