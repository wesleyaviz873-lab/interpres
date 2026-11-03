"""Chat completions through a harness or a direct provider."""

from __future__ import annotations

import json
import logging
import os
import re
import threading
import uuid
from collections.abc import Callable
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import jobs, tool_tokens
from ..auth import require_csrf, require_user
from ..database import SessionLocal, get_db
from ..harnesses import HARNESSES, clean_output, is_installed, run_harness
from ..screenshots import available as screenshots_available

from ..config import settings
from ..crypto import decrypt_secret
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

_API_DIR = Path(__file__).resolve().parents[2]
_REPO_DIR = _API_DIR.parent.parent
_TOOL_PYTHON = _API_DIR / (".venv/Scripts/python.exe" if os.name == "nt" else ".venv/bin/python")
_TOOL_SCRIPT = _REPO_DIR / "scripts" / "interpres_tool.py"
TOOL_COMMAND = f'"{_TOOL_PYTHON}" "{_TOOL_SCRIPT}" screenshot'


def _tool_hint() -> str:
    if screenshots_available():
        return (
            "Para enviar um print da tela do computador ao usuário, rode exatamente: "
            f"{TOOL_COMMAND} . A imagem aparece na conversa automaticamente; não abra "
            "visualizador e não diga que não consegue antes de tentar."
        )
    return "Este servidor não tem interface gráfica; não prometa prints de tela."


QUESTION_RE = re.compile(r"\[\[PERGUNTA\]\](.*?)\[\[/PERGUNTA\]\]", re.S)

QUESTION_RULE = [
    "Se (e só se) faltar uma decisão que só o usuário pode tomar, termine com UMA pergunta no formato exato:",
    '[[PERGUNTA]]{"question":"...","options":["...","..."]}[[/PERGUNTA]]',
    "Regras: no máximo 1 pergunta por resposta; 2 a 4 opções curtas ou nenhuma; "
    "nunca peça confirmação de um pedido claro; nunca repita pergunta já respondida; "
    "se puder inferir, não pergunte.",
]


_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
_MD_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
_WIN_IMAGE_RE = re.compile(
    r"(?<![\w])([A-Za-z]:\\[^\s`'\"<>|]+?\.(?:png|jpe?g|webp|gif))", re.I
)
_POSIX_IMAGE_RE = re.compile(r"(/[\w./-]+?\.(?:png|jpe?g|webp|gif))", re.I)


def _import_local_image(raw: str) -> str | None:
    clean = raw.strip().strip("`'\"<>")
    if clean.lower().startswith("file://"):
        clean = clean[7:]
    if clean.lower().startswith(("http://", "https://", "data:")):
        return None
    path = Path(clean)
    if path.suffix.lower() not in _IMAGE_EXTENSIONS or not path.is_file():
        return None
    try:
        if path.stat().st_size > 20 * 1024 * 1024:
            return None
        data = path.read_bytes()
    except OSError:
        return None
    directory = settings.data_dir.resolve() / "screenshots"
    directory.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{path.suffix.lower()}"
    (directory / name).write_bytes(data)
    return f"/api/screenshots/{name}"


def _ingest_local_images(reply: str) -> str:
    imported: set[str] = set()

    def markdown(match: re.Match[str]) -> str:
        target = match.group(2)
        url = _import_local_image(target)
        if not url:
            return match.group(0)
        imported.add(target)
        return f"![{match.group(1)}]({url})"

    reply = _MD_IMAGE_RE.sub(markdown, reply)

    extras: list[str] = []
    for pattern in (_WIN_IMAGE_RE, _POSIX_IMAGE_RE):
        for match in pattern.finditer(reply):
            raw = match.group(1)
            if raw in imported:
                continue
            url = _import_local_image(raw)
            if url:
                imported.add(raw)
                extras.append(f"![Print da tela]({url})")
                if len(extras) >= 2:
                    break
        if len(extras) >= 2:
            break
    if extras:
        reply = reply.rstrip() + "\n\n" + "\n\n".join(extras)
    return reply

def _parse_question(text: str) -> tuple[str, dict[str, object] | None]:
    match = QUESTION_RE.search(text)
    if not match:
        return text.strip(), None
    cleaned = (text[: match.start()] + text[match.end() :]).strip()
    try:
        data = json.loads(match.group(1).strip())
    except ValueError:
        return cleaned, None
    if not isinstance(data, dict):
        return cleaned, None
    question = data.get("question")
    if not isinstance(question, str) or not question.strip():
        return cleaned, None
    raw_options = data.get("options")
    options: list[str] = []
    if isinstance(raw_options, list):
        options = [str(item).strip()[:120] for item in raw_options if str(item).strip()][:4]
    return cleaned, {"question": question.strip()[:500], "options": options}



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
        "Execute o pedido agora com suas ferramentas. Não peça confirmação de pedidos "
        "claros; se faltar o nome do arquivo, escolha um nome curto e óbvio."
    )
    lines.append("Responda em português do Brasil, de forma direta e curta.")

    if attachments:
        lines.append("")
        lines.append("Arquivos enviados pelo usuário (caminhos reais, abra com as ferramentas):")
        for name, path, mime in attachments:
            lines.append(f"- {name} ({mime}): {path}")
    lines.append(_tool_hint())
    lines.extend(QUESTION_RULE)
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
    lines.append(_tool_hint())
    lines.extend(QUESTION_RULE)
    return "\n".join(lines)


def _run_harness(
    db: Session,
    conversation: Conversation,
    harness_id: str,
    user_env: dict[str, str],
    attachments: list[tuple[str, str, str]] | None = None,
    on_line: Callable[[str], None] | None = None,
    cancel_event: threading.Event | None = None,
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
    result = run_harness(
        harness_id,
        prompt,
        cwd,
        user_env,
        files=files,
        session=session,
        on_line=on_line,
        timeout=settings.harness_timeout_seconds,
        cancel_event=cancel_event,
    )

    if not result.get("ok") and session:
        session = None
        prompt = _harness_prompt(conversation, cwd, attachments)
        result = run_harness(
            harness_id,
            prompt,
            cwd,
            user_env,
            files=files,
            on_line=on_line,
            timeout=settings.harness_timeout_seconds,
            cancel_event=cancel_event,
        )

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


def _execute_chat(
    db: Session,
    conversation: Conversation,
    provider: str,
    model: str,
    harness_id: str | None,
    attachments: list[tuple[str, str, str]],
    on_line: Callable[[str], None] | None = None,
    cancel_event: threading.Event | None = None,
) -> tuple[str, str, dict[str, object] | None, ConversationMessage]:
    if harness_id:
        tool_env = _provider_env(db)
        tool_env["INTERPRES_TOOL_URL"] = settings.tool_base_url
        tool_env["INTERPRES_TOOL_TOKEN"] = tool_tokens.create(
            conversation.id, conversation.user_id
        )
        reply, session, process = _run_harness(
            db,
            conversation,
            harness_id,
            tool_env,
            attachments,
            on_line,
            cancel_event,
        )
        conversation.harness = harness_id
        if session:
            conversation.harness_session = session
    else:
        process = ""
        if on_line:
            on_line(f"Consultando {model}...")
        api_key = _api_key(db, provider)
        historico = [
            ChatMessage(role=message.role, content=message.content)
            for message in conversation.messages
            if message.role in {"system", "user", "assistant"}
        ]
        historico.insert(0, ChatMessage(role="system", content="\n".join(QUESTION_RULE)))
        try:
            reply = OpenCodeProvider(api_key).chat(historico, model)
        except ProviderError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
            ) from exc

    reply, question = _parse_question(reply)
    reply = _ingest_local_images(reply)

    assistant_message = ConversationMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=reply,
        process=process or None,
        question=json.dumps(question, ensure_ascii=False) if question else None,
    )
    db.add(assistant_message)
    conversation.updated_at = utcnow()
    db.commit()
    db.refresh(conversation)
    return reply, process, question, assistant_message


def _run_job(
    job_id: str,
    user_id: str,
    conversation_id: str,
    provider: str,
    model: str,
    harness_id: str | None,
    attachments: list[tuple[str, str, str]],
) -> None:
    db = SessionLocal()
    conversation: Conversation | None = None
    try:
        conversation = db.get(Conversation, conversation_id)
        if not conversation or conversation.user_id != user_id:
            jobs.fail(job_id, "Conversa não encontrada.")
            return

        def on_line(text: str) -> None:
            jobs.append(job_id, clean_output(text))

        name = HARNESSES[harness_id]["name"] if harness_id else model
        jobs.append(job_id, f"Iniciando {name}")
        reply, process, question, assistant = _execute_chat(
            db,
            conversation,
            provider,
            model,
            harness_id,
            attachments,
            on_line,
            jobs.cancel_event(job_id),
        )
        jobs.append(job_id, "Concluído")
        jobs.finish(
            job_id,
            {
                "reply": reply,
                "process": assistant.process,
                "question": question,
                "harness": harness_id,
                "conversation": serialize_conversation(
                    conversation, len(conversation.messages)
                ),
                "assistant_message_id": assistant.id,
            },
        )
    except HTTPException as exc:
        if conversation is not None:
            _persist_error(db, conversation, str(exc.detail))
        jobs.fail(job_id, str(exc.detail))
    except ProviderError as exc:
        if conversation is not None:
            _persist_error(db, conversation, str(exc))
        jobs.fail(job_id, str(exc))
    except Exception as exc:  # noqa: BLE001 - report to the UI and keep the server up
        logger.exception("Job de chat falhou")
        if conversation is not None:
            _persist_error(db, conversation, f"Erro inesperado: {exc}")
        jobs.fail(job_id, f"Erro inesperado: {exc}")
    finally:
        db.close()


@router.post("/jobs/{job_id}/cancel")
def cancel_job(
    job_id: str,
    user: User = Depends(require_csrf),
) -> dict[str, bool]:
    if not jobs.cancel(job_id, user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job não encontrado.")
    return {"ok": True}


@router.get("/jobs/{job_id}")
def job_status(
    job_id: str,
    user: User = Depends(require_user),
) -> dict[str, object]:
    data = jobs.get(job_id, user.id)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job não encontrado.")
    return data


@router.post("")
def chat(
    body: ChatRequest,
    request: Request,
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

    attachments: list[tuple[str, str, str]] = []
    for item in body.attachments:
        path = resolve_attachment(item.path, user, db)
        if path:
            attachments.append((item.name, str(path), item.mime))

    if request.headers.get("x-interpres-async") == "1":
        job_id = jobs.create(user.id)
        threading.Thread(
            target=_run_job,
            args=(
                job_id,
                user.id,
                conversation.id,
                provider,
                body.model,
                harness_id,
                attachments,
            ),
            daemon=True,
        ).start()
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={
                "job_id": job_id,
                "conversation": serialize_conversation(
                    conversation, len(conversation.messages)
                ),
                "user_message_id": user_message.id,
            },
        )

    try:
        reply, process, question, assistant = _execute_chat(
            db, conversation, provider, body.model, harness_id, attachments
        )
    except HTTPException as exc:
        _persist_error(db, conversation, str(exc.detail))
        raise
    return {
        "reply": reply,
        "process": assistant.process,
        "question": question,
        "harness": harness_id,
        "conversation": serialize_conversation(conversation, len(conversation.messages)),
        "user_message_id": user_message.id,
        "assistant_message_id": assistant.id,
    }
