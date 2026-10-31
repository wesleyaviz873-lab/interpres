"""Uploads: attachments delivered to the harness inside the project folder."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..auth import require_csrf
from ..config import settings
from ..database import get_db
from ..models import Project, User

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

MAX_BYTES = 25 * 1024 * 1024
_SAFE = re.compile(r"[^0-9A-Za-z._ -]+")


def _safe_name(raw: str) -> str:
    name = Path(raw or "arquivo").name
    name = _SAFE.sub("_", name).strip(" .") or "arquivo"
    return name[:120]


def uploads_root(project: Project | None) -> Path:
    if project:
        return Path(project.path) / ".interpres" / "uploads"
    return settings.data_dir.resolve() / "uploads"


def resolve_attachment(path: str, user: User, db: Session) -> Path | None:
    """Only files inside an uploads folder owned by this user are accepted."""
    target = Path(path).resolve()
    allowed: list[Path] = [uploads_root(None).resolve()]
    for project in db.query(Project).filter(Project.user_id == user.id).all():
        allowed.append(uploads_root(project).resolve())
    for root in allowed:
        if target == root or root in target.parents:
            return target if target.is_file() else None
    return None


@router.post("")
async def upload(
    file: UploadFile = File(...),
    project_id: str | None = Form(default=None),
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O arquivo está vazio.",
        )
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="O arquivo passa de 25 MB.",
        )

    project = None
    if project_id:
        project = db.get(Project, project_id)
        if not project or project.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Projeto inválido.",
            )
        if not Path(project.path).is_dir():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A pasta do projeto não existe mais.",
            )

    directory = uploads_root(project)
    directory.mkdir(parents=True, exist_ok=True)
    name = _safe_name(file.filename or "arquivo")
    stored = f"{uuid.uuid4().hex[:8]}_{name}"
    target = directory / stored
    target.write_bytes(data)

    return {
        "id": stored,
        "name": name,
        "path": str(target),
        "size": len(data),
        "mime": file.content_type or "application/octet-stream",
    }
