"""Install, toggle and run coding harnesses inside the Interpres workspace."""

from __future__ import annotations

import os
import re
import shutil
import signal
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


def split_progress(text: str) -> tuple[str, str]:
    """Split Hermes output into (final answer, tool progress)."""
    lines = text.splitlines()
    answer: list[str] = []
    progress: list[str] = []
    skipping = False
    for line in lines:
        if not skipping and line.lstrip().startswith(_PROGRESS_MARKS):
            skipping = True
            progress.append(line)
            continue
        if skipping:
            if _looks_like_progress(line):
                progress.append(line)
                continue
            skipping = False
        if line.strip().startswith("session_id:"):
            progress.append(line)
            continue
        answer.append(line)
    return "\n".join(answer).strip(), "\n".join(progress).strip()


def strip_progress(text: str) -> str:
    """Remove the tool-progress block Hermes prints before the final answer."""
    return split_progress(text)[0]


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
        out, err, code, timed_out = _run_process(command, Path.cwd(), env, 600)
    except OSError as exc:
        return False, f"Não foi possível executar o npm: {exc}"
    if timed_out:
        return False, "A instalação demorou mais de 10 minutos."
    if code != 0:
        detail = clean_output(err or out)[-800:]
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
        out, err, code, timed_out = _run_process(
            [binary, "--version"], Path.cwd(), _env_with_binary(harness_id), 60
        )
        output = clean_output(out or err)
        return {"ok": code == 0 and not timed_out, "output": output[:1000]}
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


def _kill_tree(process: subprocess.Popen) -> None:
    """Kill the process and every child it spawned (Windows and POSIX)."""
    if os.name == "nt":
        try:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(process.pid)],
                capture_output=True,
                timeout=20,
            )
        except Exception:  # noqa: BLE001 - best effort cleanup
            pass
    else:
        try:
            os.killpg(os.getpgid(process.pid), signal.SIGKILL)
        except Exception:  # noqa: BLE001 - best effort cleanup
            pass
    try:
        process.kill()
    except Exception:  # noqa: BLE001 - already gone
        pass


def _run_process(
    command: list[str],
    cwd: Path,
    env: dict[str, str],
    timeout: int,
) -> tuple[str, str, int, bool]:
    """Run a command with a hard timeout that also kills grandchildren."""
    kwargs: dict[str, object] = {}
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        stdin=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=str(cwd),
        env=env,
        **kwargs,
    )
    try:
        out, err = process.communicate(timeout=timeout)
        return out or "", err or "", process.returncode, False
    except subprocess.TimeoutExpired:
        _kill_tree(process)
        try:
            out, err = process.communicate(timeout=15)
        except Exception:  # noqa: BLE001 - pipes may still be held
            out, err = "", ""
        return out or "", err or "", -1, True


def run_harness(
    harness_id: str,
    prompt: str,
    cwd: Path,
    extra_env: dict[str, str] | None = None,
    timeout: int = 420,
    files: list[str] | None = None,
    session: str | None = None,
) -> dict[str, object]:
    command = command_for(harness_id, prompt, files, session)
    if not command:
        return {"ok": False, "exit_code": -1, "stdout": "", "stderr": "Harness não instalado."}
    try:
        raw_out, raw_err, code, timed_out = _run_process(
            command, cwd, _env_with_binary(harness_id, extra_env), timeout
        )
    except Exception as exc:  # noqa: BLE001 - report tool failure to the UI
        return {
            "ok": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": str(exc),
            "session": "",
        }

    if timed_out:
        return {
            "ok": False,
            "exit_code": -1,
            "stdout": clean_output(raw_out)[-2000:],
            "stderr": f"Tempo limite de {timeout // 60} minutos. O processo foi encerrado.",
            "session": "",
        }

    cleaned = clean_output(raw_out)
    progress = ""
    if HARNESSES[harness_id].get("strip_progress"):
        cleaned, progress = split_progress(cleaned)
    stdout = cleaned[-20000:]
    stderr = clean_output(raw_err)[-4000:]
    found = ""
    pattern = HARNESSES[harness_id].get("session_regex")
    if pattern:
        match = re.search(str(pattern), f"{raw_out}\n{raw_err}")
        if match:
            found = match.group(1)
    return {
        "ok": code == 0,
        "exit_code": code,
        "stdout": stdout,
        "stderr": stderr,
        "progress": progress[-8000:],
        "session": found,
    }

