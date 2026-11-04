"""Memory status, freeing and policy for heavy harness runs."""

from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path

import psutil

from .config import settings

POLICY_PATH = settings.data_dir.resolve() / "memory_policy.json"

DEFAULT_POLICY: dict[str, object] = {
    "auto": True,
    "threshold_mb": 1500,
    "targets": ["opencode-desktop", "chatgpt"],
}

TARGETS: dict[str, dict[str, str]] = {
    "wsl": {"label": "WSL (Ubuntu/Docker)"},
    "opencode-desktop": {"label": "OpenCode (app)"},
    "chatgpt": {"label": "ChatGPT / Codex (app)"},
}

_closed: list[dict[str, str]] = []


def available_mb() -> int:
    return int(psutil.virtual_memory().available / (1024 * 1024))


def _matches(target: str):
    def predicate(process: psutil.Process) -> bool:
        try:
            name = (process.name() or "").lower()
            exe = (process.exe() or "").lower()
        except (psutil.NoSuchProcess, psutil.AccessDenied, OSError):
            return False
        if target == "opencode-desktop":
            return "@opencode-aidesktop" in exe
        if target == "chatgpt":
            return name == "chatgpt.exe"
        return False

    return predicate


def _processes(target: str) -> list[psutil.Process]:
    predicate = _matches(target)
    found = []
    for process in psutil.process_iter(["pid", "name", "exe"]):
        if predicate(process):
            found.append(process)
    return found


def _wsl_memory_mb() -> int:
    total = 0
    for process in psutil.process_iter(["name", "memory_info"]):
        name = (process.info.get("name") or "").lower()
        if name in {"vmmem", "vmmemwsl"}:
            memory = process.info.get("memory_info")
            if memory:
                total += memory.rss
    return int(total / (1024 * 1024))


def status() -> dict[str, object]:
    memory = psutil.virtual_memory()
    snapshot: list[dict[str, object]] = []
    for process in psutil.process_iter(["pid", "name", "exe", "memory_info"]):
        info = process.info
        mem = info.get("memory_info")
        if not mem:
            continue
        snapshot.append(
            {
                "pid": info["pid"],
                "name": info.get("name") or "?",
                "exe": (info.get("exe") or "").lower(),
                "mb": int(mem.rss / (1024 * 1024)),
            }
        )

    top = sorted(
        ({"pid": item["pid"], "name": item["name"], "mb": item["mb"]} for item in snapshot),
        key=lambda item: item["mb"],
        reverse=True,
    )[:10]

    targets = []
    for target_id, spec in TARGETS.items():
        if target_id == "wsl":
            mb = _wsl_memory_mb()
            count = 1 if mb else 0
        else:
            if target_id == "opencode-desktop":
                matched = [item for item in snapshot if "@opencode-aidesktop" in str(item["exe"])]
            else:
                matched = [
                    item for item in snapshot if str(item["name"]).lower() == "chatgpt.exe"
                ]
            mb = sum(int(item["mb"]) for item in matched)
            count = len(matched)
        targets.append(
            {"id": target_id, "label": spec["label"], "mb": mb, "processes": count}
        )

    return {
        "total_mb": int(memory.total / (1024 * 1024)),
        "used_mb": int(memory.used / (1024 * 1024)),
        "available_mb": int(memory.available / (1024 * 1024)),
        "percent": memory.percent,
        "top": top,
        "targets": targets,
        "closed": list(_closed),
    }


def free_memory(targets: list[str]) -> dict[str, object]:
    before = available_mb()
    actions: list[str] = []
    errors: list[str] = []

    for target in targets:
        if target not in TARGETS:
            continue
        if target == "wsl":
            if os.name != "nt":
                errors.append("WSL só existe no Windows.")
                continue
            try:
                subprocess.run(
                    ["wsl", "--shutdown"], check=False, timeout=30, capture_output=True
                )
                actions.append("WSL desligado (serviços do WSL precisam ser iniciados de novo).")
            except Exception as exc:  # noqa: BLE001 - report to the UI
                errors.append(f"Falha ao desligar WSL: {exc}")
            continue

        processes = _processes(target)
        for process in processes:
            try:
                exe = process.exe()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                exe = ""
            try:
                process.terminate()
                _closed.append({"target": target, "exe": exe})
            except (psutil.NoSuchProcess, psutil.AccessDenied) as exc:
                errors.append(f"Não consegui fechar {target}: {exc}")
        if processes:
            actions.append(f"{TARGETS[target]['label']} fechado ({len(processes)} processo(s)).")

    time.sleep(1.5)
    after = available_mb()
    return {
        "before_mb": before,
        "after_mb": after,
        "freed_mb": max(0, after - before),
        "actions": actions,
        "errors": errors,
        "closed": list(_closed),
    }


def restore_apps() -> dict[str, object]:
    started: list[str] = []
    errors: list[str] = []
    for item in list(_closed):
        exe = item.get("exe") or ""
        if not exe or not Path(exe).is_file():
            continue
        try:
            if os.name == "nt":
                subprocess.Popen(
                    ["cmd", "/c", "start", "", exe],
                    close_fds=True,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
                )
            else:
                subprocess.Popen([exe], close_fds=True)
            started.append(exe)
        except Exception as exc:  # noqa: BLE001 - report to the UI
            errors.append(f"Falha ao reabrir {exe}: {exc}")
    _closed.clear()
    return {"started": started, "errors": errors}


def load_policy() -> dict[str, object]:
    try:
        data = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return dict(DEFAULT_POLICY)
    targets = data.get("targets")
    return {
        "auto": bool(data.get("auto", False)),
        "threshold_mb": int(data.get("threshold_mb", DEFAULT_POLICY["threshold_mb"])),
        "targets": [str(item) for item in targets if str(item) in TARGETS]
        if isinstance(targets, list)
        else list(DEFAULT_POLICY["targets"]),
    }


def save_policy(auto: bool, threshold_mb: int, targets: list[str]) -> dict[str, object]:
    policy = {
        "auto": bool(auto),
        "threshold_mb": max(256, min(16384, int(threshold_mb))),
        "targets": [item for item in targets if item in TARGETS],
    }
    POLICY_PATH.parent.mkdir(parents=True, exist_ok=True)
    POLICY_PATH.write_text(json.dumps(policy, indent=2), encoding="utf-8")
    return policy
