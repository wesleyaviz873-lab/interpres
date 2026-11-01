"""Interpres helper used by coding harnesses inside the project."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def screenshot() -> int:
    base = os.environ.get("INTERPRES_TOOL_URL", "http://127.0.0.1:8010").rstrip("/")
    token = os.environ.get("INTERPRES_TOOL_TOKEN", "")
    if not token:
        print("Token do Interpres ausente. Rode isto como ferramenta do chat.")
        return 1
    request = urllib.request.Request(
        f"{base}/api/tool/screenshot",
        method="POST",
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        print(f"Falha ao capturar a tela ({exc.code}): {detail[:300]}")
        return 1
    except Exception as exc:  # noqa: BLE001 - report to the harness
        print(f"Falha ao capturar a tela: {exc}")
        return 1
    print(f"Print enviado para a conversa: {data.get('image', '')}")
    return 0


def main() -> int:
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "screenshot":
        return screenshot()
    print("Uso: interpres-tool screenshot")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
