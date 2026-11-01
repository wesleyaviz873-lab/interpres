from __future__ import annotations

from fastapi.testclient import TestClient

from app import tool_tokens
from app.routes import screenshots as screenshot_routes

OWNER = {"email": "owner@example.com", "password": "correct-horse-battery"}
PNG = b"\x89PNG\r\n\x1a\nfake-image"


def _setup(client: TestClient) -> dict:
    response = client.post("/api/setup", json=OWNER)
    assert response.status_code == 201, response.text
    return response.json()


def _headers(client: TestClient) -> dict[str, str]:
    return {"X-CSRF-Token": client.get("/api/auth/me").json()["csrf_token"]}


def test_capture_creates_image_message(client: TestClient, monkeypatch) -> None:
    _setup(client)
    headers = _headers(client)
    monkeypatch.setattr(screenshot_routes, "capture_png", lambda: PNG)

    conversation = client.post("/api/conversations", headers=headers, json={}).json()
    response = client.post(
        "/api/screenshots",
        headers=headers,
        json={"conversation_id": conversation["id"]},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    image_url = payload["message"]["image"]
    assert image_url.startswith("/api/screenshots/")
    assert payload["message"]["content"] == "Print da tela"

    image = client.get(image_url)
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/png"
    assert image.content == PNG

    stored = client.get(f"/api/conversations/{conversation['id']}").json()["messages"]
    assert stored[-1]["image"] == image_url

    assert client.get("/api/screenshots/../../etc/passwd").status_code == 404


def test_capture_without_conversation_creates_one(client: TestClient, monkeypatch) -> None:
    _setup(client)
    headers = _headers(client)
    monkeypatch.setattr(screenshot_routes, "capture_png", lambda: PNG)

    response = client.post("/api/screenshots", headers=headers, json={})
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["conversation"]["title"] == "Print da tela"
    assert payload["message"]["image"]


def test_capture_reports_headless_error(client: TestClient, monkeypatch) -> None:
    _setup(client)
    headers = _headers(client)

    def fail():
        raise RuntimeError("Este servidor não tem interface gráfica para capturar a tela.")

    monkeypatch.setattr(screenshot_routes, "capture_png", fail)
    response = client.post("/api/screenshots", headers=headers, json={})
    assert response.status_code == 400
    assert "interface gráfica" in response.json()["detail"]


def test_tool_screenshot_requires_valid_token(client: TestClient, monkeypatch) -> None:
    setup = _setup(client)
    headers = _headers(client)
    monkeypatch.setattr(screenshot_routes, "capture_png", lambda: PNG)

    conversation = client.post("/api/conversations", headers=headers, json={}).json()
    token = tool_tokens.create(conversation["id"], setup["user"]["id"])

    ok = client.post(
        "/api/tool/screenshot",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["conversation_id"] == conversation["id"]
    assert ok.json()["image"].startswith("/api/screenshots/")

    invalid = client.post(
        "/api/tool/screenshot",
        headers={"Authorization": "Bearer nope"},
    )
    assert invalid.status_code == 401
