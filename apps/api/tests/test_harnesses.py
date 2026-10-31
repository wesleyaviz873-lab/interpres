from __future__ import annotations

from fastapi.testclient import TestClient

from app.routes import harnesses as harnesses_routes

OWNER = {"email": "owner@example.com", "password": "correct-horse-battery"}


def _setup(client: TestClient) -> dict:
    response = client.post("/api/setup", json=OWNER)
    assert response.status_code == 201, response.text
    return response.json()


def test_harness_list_requires_auth(client: TestClient) -> None:
    assert client.get("/api/harnesses").status_code == 401


def test_harness_list_has_known_harnesses(client: TestClient) -> None:
    _setup(client)
    response = client.get("/api/harnesses")
    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["harnesses"]}
    assert {"opencode", "claude", "codex", "gemini"} <= ids
    assert all("installed" in item and "enabled" in item for item in response.json()["harnesses"])


def test_cannot_enable_uninstalled_or_run_without_enable(client: TestClient, monkeypatch) -> None:
    setup = _setup(client)
    csrf = setup["csrf_token"]
    monkeypatch.setattr(harnesses_routes, "is_installed", lambda _: False)

    enable = client.post(
        "/api/harnesses/opencode/toggle",
        headers={"X-CSRF-Token": csrf},
        json={"enabled": True},
    )
    assert enable.status_code == 400

    run = client.post(
        "/api/harnesses/opencode/run",
        headers={"X-CSRF-Token": csrf},
        json={"prompt": "oi"},
    )
    assert run.status_code == 400


def test_unknown_harness_is_404(client: TestClient) -> None:
    setup = _setup(client)
    response = client.post(
        "/api/harnesses/unknown/toggle",
        headers={"X-CSRF-Token": setup["csrf_token"]},
        json={"enabled": True},
    )
    assert response.status_code == 404


def test_toggle_installed_harness(client: TestClient, monkeypatch) -> None:
    setup = _setup(client)
    monkeypatch.setattr(harnesses_routes, "is_installed", lambda _: True)
    response = client.post(
        "/api/harnesses/opencode/toggle",
        headers={"X-CSRF-Token": setup["csrf_token"]},
        json={"enabled": True},
    )
    assert response.status_code == 200, response.text
    assert response.json()["installed"] is True
    assert response.json()["enabled"] is True

def test_select_harness_is_exclusive(client: TestClient, monkeypatch) -> None:
    setup = _setup(client)
    monkeypatch.setattr(harnesses_routes, "is_installed", lambda _: True)
    headers = {"X-CSRF-Token": setup["csrf_token"]}

    first = client.post("/api/harnesses/claude/select", headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["selected"] is True

    second = client.post("/api/harnesses/opencode/select", headers=headers)
    assert second.status_code == 200, second.text

    listing = client.get("/api/harnesses").json()
    assert listing["selected"] == "opencode"
    selected = [item["id"] for item in listing["harnesses"] if item["selected"]]
    assert selected == ["opencode"]

    disabled = client.post(
        "/api/harnesses/opencode/toggle",
        headers=headers,
        json={"enabled": False},
    )
    assert disabled.status_code == 200
    assert disabled.json()["selected"] is False
    assert client.get("/api/harnesses").json()["selected"] is None


def test_select_requires_installed_harness(client: TestClient, monkeypatch) -> None:
    setup = _setup(client)
    monkeypatch.setattr(harnesses_routes, "is_installed", lambda _: False)
    response = client.post(
        "/api/harnesses/gemini/select",
        headers={"X-CSRF-Token": setup["csrf_token"]},
    )
    assert response.status_code == 400


def test_command_for_puts_files_before_prompt(monkeypatch) -> None:
    import app.harnesses as harnesses

    monkeypatch.setattr(harnesses, "binary_path", lambda _hid: r"C:\bin\opencode.cmd")
    command = harnesses.command_for("opencode", "crie oi.txt", [r"C:\tmp\a b.png"])
    assert command == [
        r"C:\bin\opencode.cmd",
        "run",
        "--auto",
        r"--file=C:\tmp\a b.png",
        "--",
        "crie oi.txt",
    ]

    plain = harnesses.command_for("opencode", "crie oi.txt")
    assert plain == [r"C:\bin\opencode.cmd", "run", "--auto", "crie oi.txt"]

    gemini = harnesses.command_for("gemini", "oi")
    assert gemini == [r"C:\bin\opencode.cmd", "--approval-mode", "auto_edit", "--skip-trust", "-p", "oi"]


def test_command_for_hermes_uses_session_and_image(monkeypatch) -> None:
    import app.harnesses as harnesses

    monkeypatch.setattr(harnesses, "binary_path", lambda _hid: r"C:\bin\hermes.exe")
    command = harnesses.command_for(
        "hermes",
        "crie oi.txt",
        [r"C:\tmp\a.png", r"C:\tmp\b.png"],
        "sess-9",
    )
    assert command == [
        r"C:\bin\hermes.exe",
        "chat",
        "-Q",
        "--yolo",
        "--source",
        "tool",
        "--resume",
        "sess-9",
        r"--image=C:\tmp\a.png",
        "-q",
        "crie oi.txt",
    ]


def test_strip_progress_removes_tool_preview() -> None:
    import app.harnesses as harnesses

    raw = (
        "\u250a review diff\n"
        "a/nome.txt \u2192 b/nome.txt\n"
        "@@ -0,0 +1 @@\n"
        "+conteudo\n"
        "Arquivo criado com sucesso.\n"
    )
    assert harnesses.strip_progress(raw) == "Arquivo criado com sucesso."

    plain = "Primeiro ponto\n\n- item um\n- item dois"
    assert harnesses.strip_progress(plain) == plain
