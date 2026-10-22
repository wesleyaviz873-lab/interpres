"""Small managed tunnel for exposing this installation.

Cloudflare quick tunnel needs no account. Named Cloudflare tunnels and ngrok
accept a token. The process lives inside the app container and stops when the
container stops.
"""

from __future__ import annotations

import atexit
import os
import re
import shutil
import subprocess
import threading
from datetime import datetime, timezone

PROVIDERS = {
    "cloudflare_quick": "Cloudflare (link temporário)",
    "cloudflare_token": "Cloudflare (token)",
    "ngrok": "ngrok",
}

_URL_PATTERNS = (
    re.compile(r"https://[a-z0-9.-]+\.trycloudflare\.com", re.IGNORECASE),
    re.compile(r"https://[a-z0-9.-]+\.ngrok(?:-free)?\.app", re.IGNORECASE),
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TunnelManager:
    def __init__(self) -> None:
        self._process: subprocess.Popen[str] | None = None
        self._provider: str | None = None
        self._url = ""
        self._error = ""
        self._started_at: str | None = None
        self._log: list[str] = []
        self._lock = threading.Lock()

    def _binary(self, provider: str) -> str | None:
        return shutil.which("cloudflared" if provider.startswith("cloudflare") else "ngrok")

    def _command(self, provider: str, token: str | None) -> list[str]:
        if provider == "cloudflare_quick":
            binary = self._binary(provider)
            assert binary
            return [binary, "tunnel", "--url", "http://127.0.0.1:8000", "--no-autoupdate"]
        if provider == "cloudflare_token":
            if not token:
                raise ValueError("Informe o token do túnel Cloudflare.")
            binary = self._binary(provider)
            assert binary
            return [binary, "tunnel", "--no-autoupdate", "run", "--token", token]
        if provider == "ngrok":
            if not token:
                raise ValueError("Informe o authtoken do ngrok.")
            binary = self._binary(provider)
            assert binary
            return [binary, "http", "8000", "--log=stdout", "--authtoken", token]
        raise ValueError("Provedor de túnel desconhecido.")

    def _read(self, process: subprocess.Popen[str]) -> None:
        assert process.stdout is not None
        for line in process.stdout:
            text = line.rstrip()
            if not text:
                continue
            with self._lock:
                self._log.append(text)
                self._log = self._log[-200:]
                if not self._url:
                    for pattern in _URL_PATTERNS:
                        match = pattern.search(text)
                        if match:
                            self._url = match.group(0)
                            break
        code = process.poll()
        with self._lock:
            if code and code != 0 and not self._url:
                self._error = "O túnel encerrou sem gerar um endereço."

    def start(self, provider: str, token: str | None = None) -> dict[str, object]:
        self.stop()
        if provider not in PROVIDERS:
            return {"ok": False, "error": "Provedor de túnel desconhecido."}
        if not self._binary(provider):
            return {
                "ok": False,
                "error": "O binário do túnel não está instalado nesta imagem Docker.",
            }
        try:
            command = self._command(provider, token.strip() if token else None)
        except ValueError as exc:
            return {"ok": False, "error": str(exc)}

        env = {**os.environ, "HOME": "/tmp", "NO_COLOR": "1"}
        try:
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                env=env,
            )
        except OSError as exc:
            return {"ok": False, "error": f"Não foi possível iniciar o túnel: {exc}"}

        with self._lock:
            self._process = process
            self._provider = provider
            self._url = ""
            self._error = ""
            self._started_at = _now_iso()
            self._log = []
        threading.Thread(target=self._read, args=(process,), daemon=True).start()
        return {"ok": True, **self.status()}

    def stop(self) -> dict[str, object]:
        with self._lock:
            process = self._process
            self._process = None
        if process and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        with self._lock:
            self._provider = None
            self._url = ""
            self._error = ""
            self._started_at = None
        return {"ok": True}

    def status(self) -> dict[str, object]:
        with self._lock:
            running = bool(self._process and self._process.poll() is None)
            return {
                "running": running,
                "provider": self._provider,
                "url": self._url,
                "started_at": self._started_at,
                "error": self._error,
                "log": self._log[-30:],
            }


tunnel_manager = TunnelManager()
atexit.register(tunnel_manager.stop)
