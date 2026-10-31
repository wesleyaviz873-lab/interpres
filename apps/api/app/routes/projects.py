"""Projects: the folder the assistant is allowed to work in."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_csrf, require_user
from ..config import settings
from ..database import get_db
from ..models import Conversation, Project, User, utcnow

router = APIRouter(prefix="/api/projects", tags=["projects"])

_DIALOG_SCRIPT = """
import sys
try:
    import tkinter as tk
    from tkinter import filedialog
except Exception as exc:
    print(f"ERRO: {exc}")
    sys.exit(1)
root = tk.Tk()
root.withdraw()
root.attributes("-topmost", True)
path = filedialog.askdirectory(title="Escolha a pasta do projeto")
root.destroy()
print(path or "")
"""


class ProjectRequest(BaseModel):
    path: str = Field(min_length=1, max_length=4096)
    name: str | None = Field(default=None, max_length=200)


def _serialize(project: Project, conversations: int = 0, exists: bool = True) -> dict[str, object]:
    return {
        "id": project.id,
        "name": project.name,
        "path": project.path,
        "exists": exists,
        "conversations": conversations,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
    }


def _counts(db: Session, user: User) -> dict[str, int]:
    rows = db.scalars(
        select(Conversation).where(
            Conversation.user_id == user.id,
            Conversation.project_id.is_not(None),
        )
    ).all()
    counts: dict[str, int] = {}
    for row in rows:
        if row.project_id:
            counts[row.project_id] = counts.get(row.project_id, 0) + 1
    return counts


@router.get("")
def list_projects(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    projects = db.scalars(
        select(Project).where(Project.user_id == user.id).order_by(Project.updated_at.desc())
    ).all()
    counts = _counts(db, user)
    return {
        "projects": [
            _serialize(project, counts.get(project.id, 0), Path(project.path).is_dir())
            for project in projects
        ]
    }


def _store(db: Session, user: User, path: Path) -> Project:
    resolved = str(path.resolve())
    existing = db.scalars(
        select(Project).where(Project.user_id == user.id, Project.path == resolved)
    ).first()
    if existing:
        existing.updated_at = utcnow()
        db.commit()
        return existing

    project = Project(user_id=user.id, name=path.name or resolved, path=resolved)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.post("")
def add_project(
    body: ProjectRequest,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    path = Path(body.path).expanduser()
    if not path.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A pasta informada não existe.",
        )
    project = _store(db, user, path)
    if body.name:
        project.name = body.name.strip() or project.name
        db.commit()
    return _serialize(project, 0, True)


@router.post("/pick")
def pick_project(
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    """Open the native folder dialog on the host and remember the choice."""
    if not settings.is_local_mode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O seletor de pastas só existe no modo local.",
        )
    try:
        result = subprocess.run(
            [sys.executable, "-c", _DIALOG_SCRIPT],
            capture_output=True,
            text=True,
            timeout=600,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Não foi possível abrir o seletor de pastas: {exc}",
        ) from exc

    output = (result.stdout or "").strip().splitlines()
    chosen = output[-1].strip() if output else ""
    if result.returncode != 0 or not chosen:
        if result.returncode != 0 and "ERRO" in (result.stdout or ""):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(result.stdout or "").strip()[:200],
            )
        return {"cancelled": True, "project": None}

    path = Path(chosen)
    if not path.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A pasta escolhida não existe.",
        )
    return {"cancelled": False, "project": _serialize(_store(db, user, path), 0, True)}


@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projeto não encontrado.")
    db.delete(project)
    db.commit()
    return {"ok": True}
