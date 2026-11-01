"""Screen capture helpers for hosts with a desktop session."""

from __future__ import annotations

import io
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def available() -> bool:
    if os.name == "nt":
        return True
    return bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))


def capture_png() -> bytes:
    """Return a PNG of the primary desktop. Raises RuntimeError when impossible."""
    if os.name == "nt":
        try:
            from PIL import ImageGrab
        except Exception as exc:  # noqa: BLE001 - Pillow missing
            raise RuntimeError("Pillow não está instalado para capturar a tela.") from exc
        try:
            image = ImageGrab.grab(all_screens=True)
        except Exception as exc:  # noqa: BLE001 - no desktop session
            raise RuntimeError(
                "Não consegui capturar a tela. Rode o Interpres em uma sessão com área de trabalho."
            ) from exc
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()

    if not available():
        raise RuntimeError("Este servidor não tem interface gráfica para capturar a tela.")

    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / "print.png"
        commands = [
            ["gnome-screenshot", "-f", str(target)],
            ["scrot", str(target)],
            ["import", "-window", "root", str(target)],
        ]
        for command in commands:
            if not shutil.which(command[0]):
                continue
            try:
                subprocess.run(command, check=True, timeout=20, capture_output=True)
            except Exception:  # noqa: BLE001 - try the next tool
                continue
            if target.exists():
                return target.read_bytes()
    raise RuntimeError("Nenhuma ferramenta de captura disponível (gnome-screenshot, scrot ou import).")
