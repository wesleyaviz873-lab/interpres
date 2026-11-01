"""Chat completions through a harness or a direct provider."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_csrf
from ..config import settings
from ..crypto import decrypt_secret
from ..database import get_db
from ..harnesses import HARNESSES, is_installed, run_harness
from ..models import (
    Conversation,
    ConversationMessage,
    HarnessSetting,
    Project,
    ProviderKey,
    User,
    utcnow,
)
from ..providers.base import ChatMessage, ProviderError
from ..providers.opencode import OpenCodeProvider
from .conversations import serialize as serialize_conversation
from .uploads import resolve_attachment

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

DEFAULT_TITLE = "Nova conversa"
PROMPT_BUDGET = 12000


class ChatMessageIn(BaseModel):
    role: str = Field(default="user", max_length=20)
    content: str = Field(min_length=1, max_length=200_000)


class ChatAttachmentIn(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    path: str = Field(min_length=1, max_length=4096)
    mime: str = Field(default="application/octet-stream", max_length=200)


class ChatRequest(BaseModel):
    provider: str = Field(min_length=1, max_length=40)
    model: str = Field(min_length=1, max_length=200)
    messages: list[ChatMessageIn] = Field(default_factory=list, max_length=200)
    conversation_id: str | None = Field(default=None, max_length=36)
    project_id: str | None = Field(default=None, max_length=36)
    attachments: list[ChatAttachmentIn] = Field(default_factory=list, max_length=10)


def _api_key(db: Session, provider: str) -> str:
    row = db.get(ProviderKey, provider)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Configure a chave do provedor '{provider}' em Configurações.",
        )
    try:
        return decrypt_secret(row.encrypted_value)
    except Exception as exc:  # noqa: BLE001 - never leak the stored value
        logger.warning("Não consegui decifrar a chave de %s: %s", provider, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não foi possível ler a chave salva.",
        ) from exc


def selected_harness(db: Session) -> str | None:
    """Return the harness chosen for chat, if it is installed."""
    row = db.scalars(
        select(HarnessSetting).where(HarnessSetting.selected.is_(True))
    ).first()
    if row and is_installed(row.id):
        return row.id
    return None


def _title_from(text: str) -> str:
    clean = " ".join(text.split())
    if not clean:
        return DEFAULT_TITLE
    return clean[:60] + ("…" if len(clean) > 60 else "")


def _conversation_for(
    db: Session,
    user: User,
    body: ChatRequest,
    new_message: str,
) -> Conversation:
    if body.conversation_id:
        conversation = db.get(Conversation, body.conversation_id)
        if not conversation or conversation.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversa não encontrada.",
            )
        return conversation

    project_id = None
    if body.project_id:
        project = db.get(Project, body.project_id)
        if project and project.user_id == user.id:
            project_id = project.id

    conversation = Conversation(
        user_id=user.id,
        title=_title_from(new_message),
        project_id=project_id,
        provider=body.provider,
        model=body.model,
    )
    db.add(conversation)
    db.flush()
    return conversation


def _harness_cwd(db: Session, conversation: Conversation) -> Path:
    if conversation.project_id:
        project = db.get(Project, conversation.project_id)
        if project:
            path = Path(project.path)
            if path.is_dir():
                return path
    workspace = settings.workspace_dir.resolve()
    workspace.mkdir(parents=True, exist_ok=True)
    return workspace



def _harness_prompt(
    conversation: Conversation,
    cwd: Path,
    attachments: list[tuple[str, str, str]] | None = None,
) -> str:
    pedacos = [
        " ".join(message.content.split())
        for message in conversation.messages
        if message.role == "user"
    ][-6:]
    merged = " | ".join(pedacos)
    if len(merged) > PROMPT_BUDGET:
        merged = "…(início omitido) " + merged[-PROMPT_BUDGET:]

    desktop = Path.home() / "Desktop"
    lines = [f"PEDIDO DO USUÁRIO (mensagens em ordem, junte tudo e execute): {merged}", ""]
    lines.append(f"Pasta de trabalho atual: {cwd}")
    lines.append(f"Área de Trabalho (Desktop) do usuário: {desktop}")
    lines.append(
        "Você tem acesso real ao computador: pode ler, criar, editar e apagar "
        "arquivos e executar comandos."
    )
    lines.append(
        "Execute o pedido agora com suas ferramentas. Não faça perguntas de "
        "esclarecimento: se faltar o nome do arquivo, escolha um nome curto e óbvio."
    )
    lines.append("Responda em português do Brasil, de forma direta e curta.")

    if attachments:
        lines.append("")
        lines.append("Arquivos enviados pelo usuário (caminhos reais, abra com as ferramentas):")
        for name, path, mime in attachments:
            lines.append(f"- {name} ({mime}): {path}")
    return "\n".join(lines)


def _followup_prompt(
    conversation: Conversation,
    cwd: Path,
    attachments: list[tuple[str, str, str]] | None = None,
) -> str:
    """Short prompt for a harness session that already knows the history."""
    task = ""
    for message in reversed(conversation.messages):
        if message.role == "user":
            task = message.content
            break
    lines = [task, "", f"Pasta de trabalho atual: {cwd}"]
    if attachments:
        lines.append("Arquivos enviados pelo usuário (caminhos reais):")
        for name, path, mime in attachments:
            lines.append(f"- {name} ({mime}): {path}")
    return "\n".join(lines)


def _run_harness(
    db: Session,
    conversation: Conversation,
    harness_id: str,
    user_env: dict[str, str],
    attachments: list[tuple[str, str, str]] | None = None,
) -> tuple[str, str, str]:
    cwd = _harness_cwd(db, conversation)
    session = conversation.harness_session if conversation.harness == harness_id else None
    files: list[str] = []
    if attachments:
        if harness_id == "codex":
            files = [path for _name, path, mime in attachments if mime.startswith("image/")]
        elif harness_id == "hermes":
            files = [path for _name, path, mime in attachments if mime.startswith("image/")]
        else:
            files = [path for _name, path, _mime in attachments]

    prompt = (
        _followup_prompt(conversation, cwd, attachments)
        if session
        else _harness_prompt(conversation, cwd, attachments)
    )
    result = run_harness(harness_id, prompt, cwd, user_env, files=files, session=session)

    if not result.get("ok") and session:
        session = None
        prompt = _harness_prompt(conversation, cwd, attachments)
        result = run_harness(harness_id, prompt, cwd, user_env, files=files)

    stdout = str(result.get("stdout") or "").strip()
    stderr = str(result.get("stderr") or "").strip()
    if not result.get("ok"):
        name = HARNESSES[harness_id]["name"]
        detail = stderr or stdout or "sem saída"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{name} falhou ({result.get('exit_code')}): {detail[-600:]}",
        )
    if not stdout:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{HARNESSES[harness_id]['name']} não devolveu texto: {stderr[-400:]}",
        )
    parts: list[str] = []
    progress = str(result.get("progress") or "").strip()
    if progress:
        parts.append(progress)
    harness_stderr = "\n".join(
        line
        for line in stderr.splitlines()
        if not line.strip().startswith(("session_id:", "Resumed session"))
    ).strip()
    if harness_stderr:
        parts.append(harness_stderr)
    return stdout, str(result.get("session") or ""), "\n".join(parts)[:8000]


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


def _persist_error(db: Session, conversation: Conversation, detail: str) -> None:
    """Store a visible failure so the user sees it after a reload."""
    text = f"Falhou: {detail}".strip()[:4000]
    db.add(
        ConversationMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=text,
        )
    )
    conversation.updated_at = utcnow()
    db.commit()


@router.post("")
def chat(
    body: ChatRequest,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    provider = body.provider.strip().lower()
    if not body.messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Envie ao menos uma mensagem.",
        )

    last = body.messages[-1]
    if last.role != "user":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A última mensagem precisa ser do usuário.",
        )

    harness_id = selected_harness(db)
    if provider != "opencode" and not harness_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este provedor ainda não está habilitado no chat. Use OpenCode.",
        )

    conversation = _conversation_for(db, user, body, last.content)

    if conversation.title == DEFAULT_TITLE:
        conversation.title = _title_from(last.content)
    conversation.provider = provider
    conversation.model = body.model
    conversation.updated_at = utcnow()

    user_message = ConversationMessage(
        conversation_id=conversation.id,
        role="user",
        content=last.content,
    )
    db.add(user_message)
    db.commit()

    if harness_id:
        attachments: list[tuple[str, str, str]] = []
        for item in body.attachments:
            path = resolve_attachment(item.path, user, db)
            if path:
                attachments.append((item.name, str(path), item.mime))
        try:
            reply, session, process = _run_harness(
                db,
                conversation,
                harness_id,
                _provider_env(db),
                attachments,
            )
        except HTTPException as exc:
            logger.warning("Falha no harness %s: %s", harness_id, exc.detail)
            _persist_error(db, conversation, str(exc.detail))
            raise
        conversation.harness = harness_id
        if session:
            conversation.harness_session = session
    else:
        process = ""
        api_key = _api_key(db, provider)
        historico = [
            ChatMessage(role=message.role, content=message.content)
            for message in conversation.messages
            if message.role in {"system", "user", "assistant"}
        ]
        try:
            reply = OpenCodeProvider(api_key).chat(historico, body.model)
        except ProviderError as exc:
            logger.warning("Falha no chat OpenCode: %s", exc)
            _persist_error(db, conversation, str(exc))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
            ) from exc

    assistant_message = ConversationMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=reply,
        process=process or None,
    )
    db.add(assistant_message)
    conversation.updated_at = utcnow()
    db.commit()
    db.refresh(conversation)

    return {
        "reply": reply,
        "process": assistant_message.process,
        "harness": harness_id,
        "conversation": serialize_conversation(conversation, len(conversation.messages)),
        "user_message_id": user_message.id,
        "assistant_message_id": assistant_message.id,
    }
