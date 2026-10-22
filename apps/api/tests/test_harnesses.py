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
