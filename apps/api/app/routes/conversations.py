"""Conversations and messages persisted for the owner."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_csrf, require_user
from ..database import get_db
from ..models import Conversation, ConversationMessage, Project, User, utcnow

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

DEFAULT_TITLE = "Nova conversa"


class ConversationRequest(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    project_id: str | None = Field(default=None, max_length=36)
    provider: str | None = Field(default=None, max_length=40)
    model: str | None = Field(default=None, max_length=200)


class ConversationUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    project_id: str | None = Field(default=None, max_length=36)


def serialize(conversation: Conversation, message_count: int = 0) -> dict[str, object]:
    return {
        "id": conversation.id,
        "title": conversation.title,
        "project_id": conversation.project_id,
        "provider": conversation.provider,
        "model": conversation.model,
        "messages": message_count,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat(),
    }


def _parse_question(raw: str | None) -> dict[str, object] | None:
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def serialize_message(message: ConversationMessage) -> dict[str, object]:
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "process": message.process,
        "question": _parse_question(message.question),
        "created_at": message.created_at.isoformat(),
    }


def _owned(db: Session, user: User, conversation_id: str) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    if not conversation or conversation.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversa não encontrada.",
        )
    return conversation


def _valid_project(db: Session, user: User, project_id: str | None) -> str | None:
    if not project_id:
        return None
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Projeto inválido.",
        )
    return project.id


@router.get("")
def list_conversations(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    rows = db.scalars(
        select(Conversation)
        .where(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(200)
    ).all()
    return {
        "conversations": [
            serialize(row, len(row.messages)) for row in rows
        ]
    }


@router.post("")
def create_conversation(
    body: ConversationRequest,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    conversation = Conversation(
        user_id=user.id,
        title=(body.title or "").strip() or DEFAULT_TITLE,
        project_id=_valid_project(db, user, body.project_id),
        provider=body.provider,
        model=body.model,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return serialize(conversation)


@router.get("/{conversation_id}")
def read_conversation(
    conversation_id: str,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    conversation = _owned(db, user, conversation_id)
    messages = [serialize_message(message) for message in conversation.messages]
    return {
        "conversation": serialize(conversation, len(messages)),
        "messages": messages,
    }


@router.patch("/{conversation_id}")
def update_conversation(
    conversation_id: str,
    body: ConversationUpdate,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    conversation = _owned(db, user, conversation_id)
    if body.title is not None:
        conversation.title = body.title.strip()[:200] or DEFAULT_TITLE
    if "project_id" in body.model_fields_set:
        conversation.project_id = _valid_project(db, user, body.project_id)
    conversation.updated_at = utcnow()
    db.commit()
    db.refresh(conversation)
    return serialize(conversation, len(conversation.messages))


@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    conversation = _owned(db, user, conversation_id)
    db.delete(conversation)
    db.commit()
    return {"ok": True}
