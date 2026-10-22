"""Read-only detection of coding agents installed on the host."""

from __future__ import annotations

import shutil

from fastapi import APIRouter, Depends

from ..auth import require_user
from ..models import User

router = APIRouter(prefix="/api/agents", tags=["agents"])

AGENTS = [
    {"id": "claude", "name": "Claude Code", "command": "claude", "color": "#F97316"},
    {"id": "codex", "name": "Codex CLI", "command": "codex", "color": "#10A37F"},
    {"id": "opencode", "name": "OpenCode", "command": "opencode", "color": "#06B6D4"},
    {"id": "gemini", "name": "Gemini CLI", "command": "gemini", "color": "#4285F4"},
    {"id": "cursor", "name": "Cursor", "command": "cursor", "color": "#8B5CF6"},
]


@router.get("")
def list_agents(user: User = Depends(require_user)) -> dict[str, object]:
    return {
        "agents": [
            {
                **agent,
                "installed": shutil.which(agent["command"]) is not None,
            }
            for agent in AGENTS
        ]
    }
