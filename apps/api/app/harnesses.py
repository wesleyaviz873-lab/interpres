"""Install, toggle and run coding harnesses inside the Interpres workspace."""

from __future__ import annotations

import os
import re
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
        "prompt_flag": None,
        "file_flag": "--file",
        "env_key": "OPENAI_API_KEY",
    },
    "claude": {
        "name": "Claude Code",
        "description": "Agente de código da Anthropic.",
        "package": "@anthropic-ai/claude-code",
        "binary": "claude",
        "args": ["-p", "--permission-mode", "acceptEdits"],
        "prompt_flag": None,
        "file_flag": None,
        "env_key": "ANTHROPIC_API_KEY",
    },
    "codex": {
        "name": "Codex CLI",
        "description": "Agente de código da OpenAI.",
        "package": "@openai/codex",
        "binary": "codex",
        "args": ["exec", "--full-auto", "--skip-git-repo-check"],
        "prompt_flag": None,
        "file_flag": "--image",
        "env_key": "OPENAI_API_KEY",
    },
    "gemini": {
        "name": "Gemini CLI",
        "description": "Agente de código do Google.",
        "package": "@google/gemini-cli",
        "binary": "gemini",
        "args": ["--approval-mode", "auto_edit", "--skip-trust"],
        "prompt_flag": "-p",
        "file_flag": None,
        "env_key": "GEMINI_API_KEY",
    },
    "hermes": {
        "name": "Hermes Agent",
        "description": "Agente da Nous Research com memória, skills e aprendizado próprios.",
        "package": "hermes-agent",
        "binary": "hermes",
        "args": ["chat", "-Q", "--yolo", "--source", "tool"],
        "prompt_flag": "-q",
        "file_flag": "--image",
        "session_flag": "--resume",
        "session_regex": r"session_id:\s*([0-9A-Za-z_-]+)",
        "single_file": True,
        "strip_progress": True,
        "env_key": "HERMES_API_KEY",
    },
}

_ANSI = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]")
_WINDOWS_SUFFIXES = (".cmd", ".exe", ".bat", ".ps1")


def clean_output(text: str | None) -> str:
    """Strip ANSI escapes and normalize line endings."""
    return _ANSI.sub("", (text or "").replace("\r\n", "\n")).strip()


_PROGRESS_MARKS = ("┊", "│", "┃")


def _looks_like_progress(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    if stripped.startswith(("@@", "a/", "b/", "+", "-")):
        return True
    if "→" in stripped or "review diff" in stripped.lower():
        return True
    return False


def strip_progress(text: str) -> str:
    """Remove the tool-progress block Hermes prints before the final answer."""
    lines = text.splitlines()
    result: list[str] = []
    skipping = False
    for line in lines:
        if not skipping and line.lstrip().startswith(_PROGRESS_MARKS):
            skipping = True
            continue
        if skipping:
            if _looks_like_progress(line):
                continue
            skipping = False
        if line.strip().startswith("session_id:"):
            continue
        result.append(line)
    return "\n".join(result).strip()


def _home() -> str:
    if os.name == "nt":
        return os.environ.get("USERPROFILE") or str(settings.data_dir)
    return "/tmp"


def _bin_dirs() -> list[Path]:
    return [DEFAULT_ROOT / "node_modules" / ".bin", DATA_ROOT / "node_modules" / ".bin"]


def _names(binary: str) -> list[str]:
    names = [binary]
    if os.name == "nt":
        names += [binary + suffix for suffix in _WINDOWS_SUFFIXES]
    return names


def binary_path(harness_id: str) -> str | None:
    spec = HARNESSES.get(harness_id)
    if not spec:
        return None
    binary = str(spec["binary"])
    for directory in _bin_dirs():
        for name in _names(binary):
            candidate = directory / name
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
    env = {**os.environ, "HOME": _home(), "NO_COLOR": "1", "CI": "1"}
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
        detail = clean_output(result.stderr or result.stdout)[-800:]
        return False, detail or "O npm recusou a instalação."
    return True, ""


def _env_with_binary(harness_id: str, extra: dict[str, str] | None = None) -> dict[str, str]:
    binary = binary_path(harness_id)
    bin_dir = str(Path(binary).parent) if binary else ""
    env = {
        **os.environ,
        "HOME": _home(),
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
            timeout=60,
            env=_env_with_binary(harness_id),
        )
        output = clean_output(result.stdout or result.stderr)
        return {"ok": result.returncode == 0, "output": output[:1000]}
    except Exception as exc:  # noqa: BLE001 - report tool failure to the UI
        return {"ok": False, "output": str(exc)}


def command_for(
    harness_id: str,
    prompt: str,
    files: list[str] | None = None,
    session: str | None = None,
) -> list[str] | None:
    spec = HARNESSES.get(harness_id)
    binary = binary_path(harness_id)
    if not spec or not binary:
        return None
    args = [str(item) for item in spec.get("args", [])]
    session_flag = spec.get("session_flag")
    if session_flag and session:
        args.extend([str(session_flag), session])
    file_flag = spec.get("file_flag")
    selected_files = files or []
    if spec.get("single_file"):
        selected_files = selected_files[:1]
    has_files = bool(file_flag and selected_files)
    if has_files:
        for path in selected_files:
            args.append(f"{file_flag}={path}")
    flag = spec.get("prompt_flag")
    if flag:
        return [binary, *args, str(flag), prompt]
    if has_files:
        return [binary, *args, "--", prompt]
    return [binary, *args, prompt]


def run_harness(
    harness_id: str,
    prompt: str,
    cwd: Path,
    extra_env: dict[str, str] | None = None,
    timeout: int = 600,
    files: list[str] | None = None,
    session: str | None = None,
) -> dict[str, object]:
    command = command_for(harness_id, prompt, files, session)
    if not command:
        return {"ok": False, "exit_code": -1, "stdout": "", "stderr": "Harness não instalado."}
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            cwd=str(cwd),
            env=_env_with_binary(harness_id, extra_env),
        )
        stdout = clean_output(result.stdout)[-20000:]
        stderr = clean_output(result.stderr)[-4000:]
        if HARNESSES[harness_id].get("strip_progress"):
            stdout = strip_progress(stdout)
        found = ""
        pattern = HARNESSES[harness_id].get("session_regex")
        if pattern:
            match = re.search(str(pattern), f"{result.stdout or ''}\n{result.stderr or ''}")
            if match:
                found = match.group(1)
        return {
            "ok": result.returncode == 0,
            "exit_code": result.returncode,
            "stdout": stdout,
            "stderr": stderr,
            "session": found,
        }
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": "Tempo limite de 10 minutos.",
            "session": "",
        }
    except Exception as exc:  # noqa: BLE001 - report tool failure to the UI
        return {
            "ok": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": str(exc),
            "session": "",
        }

