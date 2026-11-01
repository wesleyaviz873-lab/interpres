from __future__ import annotations

from fastapi.testclient import TestClient

from app.routes import transcribe as transcribe_routes

OWNER = {"email": "owner@example.com", "password": "correct-horse-battery"}


def _setup(client: TestClient) -> dict:
    response = client.post("/api/setup", json=OWNER)
    assert response.status_code == 201, response.text
    return response.json()


def _headers(client: TestClient) -> dict[str, str]:
    return {"X-CSRF-Token": client.get("/api/auth/me").json()["csrf_token"]}


def test_transcribe_needs_openai_key(client: TestClient) -> None:
    _setup(client)
    headers = _headers(client)
    response = client.post(
        "/api/transcribe",
        headers=headers,
        files={"file": ("audio.webm", b"fake", "audio/webm")},
        data={"language": "pt-BR"},
    )
    assert response.status_code == 400
    assert "OpenAI" in response.json()["detail"]


def test_transcribe_calls_openai(client: TestClient, monkeypatch) -> None:
    _setup(client)
    headers = _headers(client)
    client.put("/api/providers/openai", headers=headers, json={"value": "sk-test"})

    captured: dict = {}

    class FakeResponse:
        status_code = 200
        text = ""

        def json(self):
            return {"text": "  olá mundo  "}

    def fake_post(url, headers=None, files=None, data=None, timeout=None):
        captured["url"] = url
        captured["auth"] = headers.get("Authorization")
        captured["data"] = data
        captured["filename"] = files["file"][0]
        return FakeResponse()

    monkeypatch.setattr(transcribe_routes.requests, "post", fake_post)

    response = client.post(
        "/api/transcribe",
        headers=headers,
        files={"file": ("audio.webm", b"fake-audio", "audio/webm")},
        data={"language": "pt-BR"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["text"] == "olá mundo"
    assert captured["auth"] == "Bearer sk-test"
    assert captured["data"]["model"] == "whisper-1"
    assert captured["data"]["language"] == "pt"
    assert captured["filename"] == "audio.webm"


def test_transcribe_reports_openai_error(client: TestClient, monkeypatch) -> None:
    _setup(client)
    headers = _headers(client)
    client.put("/api/providers/openai", headers=headers, json={"value": "sk-test"})

    class FakeResponse:
        status_code = 401
        text = '{"error":"invalid key"}'

    monkeypatch.setattr(
        transcribe_routes.requests, "post", lambda *a, **k: FakeResponse()
    )

    response = client.post(
        "/api/transcribe",
        headers=headers,
        files={"file": ("audio.webm", b"fake-audio", "audio/webm")},
    )
    assert response.status_code == 400
    assert "inválida" in response.json()["detail"]
