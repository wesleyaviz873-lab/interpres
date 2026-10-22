"""Install, toggle and run coding harnesses inside the Interpres workspace."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from .config import settings

DEFAULT_ROOT = Path("/opt/interpres/harnesses")
DATA_ROOT = settings.data_dir / "harnesses"

HARNESSES: dict[str, dict[str, object]] = {
    "opencode": {
        "name": "OpenCode",
        "description": "Harness open source, recomendado para começar.",
        "package": "opencode-ai",
        "binary": "opencode",
        "args": ["run", "--auto"],
        "stdin": True,
        "env_key": "OPENAI_API_KEY",
    },
    "claude": {
        "name": "Claude Code",
        "description": "Agente de código da Anthropic.",
        "package": "@anthropic-ai/claude-code",
        "binary": "claude",
        "args": ["-p", "--permission-mode", "acceptEdits"],
        "stdin": False,
        "env_key": "ANTHROPIC_API_KEY",
    },
    "codex": {
        "name": "Codex CLI",
        "description": "Agente de código da OpenAI.",
        "package": "@openai/codex",
        "binary": "codex",
        "args": ["exec", "--full-auto"],
        "stdin": False,
        "env_key": "OPENAI_API_KEY",
    },
    "gemini": {
        "name": "Gemini CLI",
        "description": "Agente de código do Google.",
        "package": "@google/gemini-cli",
        "binary": "gemini",
        "args": ["-p"],
        "stdin": False,
        "env_key": "GEMINI_API_KEY",
    },
}


def _bin_dirs() -> list[Path]:
    return [DEFAULT_ROOT / "node_modules" / ".bin", DATA_ROOT / "node_modules" / ".bin"]


def binary_path(harness_id: str) -> str | None:
    spec = HARNESSES.get(harness_id)
    if not spec:
        return None
    binary = str(spec["binary"])
    for directory in _bin_dirs():
        candidate = directory / binary
        if candidate.exists():
            return str(candidate)
    return shutil.which(binary)


def is_installed(harness_id: str) -> bool:
    return binary_path(harness_id) is not None


def _npm() -> str | None:
    return shutil.which("npm") or shutil.which("npm.cmd")


def install(harness_id: str) -> tuple[bool, str]:
    spec = HARNESSES.get(harness_id)
    if not spec:
        return False, "Harness desconhecido."
    npm = _npm()
    if not npm:
        return False, "npm não está disponível nesta imagem."
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    command = [
        npm,
        "install",
        "--prefix",
        str(DATA_ROOT),
        "--no-audit",
        "--no-fund",
        str(spec["package"]),
    ]
    env = {**os.environ, "HOME": "/tmp", "NO_COLOR": "1", "CI": "1"}
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=600,
            env=env,
        )
    except subprocess.TimeoutExpired:
        return False, "A instalação demorou mais de 10 minutos."
    except OSError as exc:
        return False, f"Não foi possível executar o npm: {exc}"
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()[-800:]
        return False, detail or "O npm recusou a instalação."
    return True, ""


def _env_with_binary(harness_id: str, extra: dict[str, str] | None = None) -> dict[str, str]:
    binary = binary_path(harness_id)
    bin_dir = str(Path(binary).parent) if binary else ""
    env = {
        **os.environ,
        "HOME": "/tmp",
        "NO_COLOR": "1",
        "CI": "1",
        "PATH": f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}" if bin_dir else os.environ.get("PATH", ""),
    }
    if extra:
        env.update(extra)
    return env


def test_harness(harness_id: str) -> dict[str, object]:
    binary = binary_path(harness_id)
    if not binary:
        return {"ok": False, "output": "Harness não instalado."}
    try:
        result = subprocess.run(
            [binary, "--version"],
            capture_output=True,
            text=True,
            timeout=30,
            env=_env_with_binary(harness_id),
        )
        output = (result.stdout or result.stderr or "").strip()
        return {"ok": result.returncode == 0, "output": output[:1000]}
    except Exception as exc:  # noqa: BLE001 - report tool failure to the UI
        return {"ok": False, "output": str(exc)}


def run_harness(
    harness_id: str,
    prompt: str,
    cwd: Path,
    extra_env: dict[str, str] | None = None,
) -> dict[str, object]:
    spec = HARNESSES.get(harness_id)
    binary = binary_path(harness_id)
    if not spec or not binary:
        return {"ok": False, "exit_code": -1, "stdout": "", "stderr": "Harness não instalado."}

    args = [str(item) for item in spec.get("args", [])]
    stdin_prompt = bool(spec.get("stdin"))
    command = [binary, *args] if stdin_prompt else [binary, *args, prompt]
    try:
        result = subprocess.run(
            command,
            input=prompt if stdin_prompt else None,
            capture_output=True,
            text=True,
            timeout=600,
            cwd=str(cwd),
            env=_env_with_binary(harness_id, extra_env),
        )
        return {
            "ok": result.returncode == 0,
            "exit_code": result.returncode,
            "stdout": (result.stdout or "")[-20000:],
            "stderr": (result.stderr or "")[-4000:],
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "exit_code": -1, "stdout": "", "stderr": "Tempo limite de 10 minutos."}
    except Exception as exc:  # noqa: BLE001 - report tool failure to the UI
        return {"ok": False, "exit_code": -1, "stdout": "", "stderr": str(exc)}
