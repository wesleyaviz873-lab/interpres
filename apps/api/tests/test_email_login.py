from __future__ import annotations

from fastapi.testclient import TestClient

from app.routes import auth as auth_routes

OWNER = {"email": "owner@example.com", "password": "correct-horse-battery"}


def _setup(client: TestClient) -> dict:
    response = client.post("/api/setup", json=OWNER)
    assert response.status_code == 201, response.text
    return response.json()


def test_email_code_login_without_password(client: TestClient, monkeypatch) -> None:
    _setup(client)
    captured: dict[str, str] = {}

    def fake_send(email: str, code: str) -> None:
        captured["email"] = email
        captured["code"] = code

    monkeypatch.setattr(auth_routes, "send_login_code", fake_send)
    client.cookies.clear()

    sent = client.post("/api/auth/email-code", json={"email": OWNER["email"]})
    assert sent.status_code == 200, sent.text
    assert captured["email"] == OWNER["email"]
    assert len(captured["code"]) == 6

    logged = client.post(
        "/api/auth/email-login",
        json={"email": OWNER["email"], "code": captured["code"]},
    )
    assert logged.status_code == 200, logged.text
    assert client.get("/api/auth/me").status_code == 200

    reused = client.post(
        "/api/auth/email-login",
        json={"email": OWNER["email"], "code": captured["code"]},
    )
    assert reused.status_code == 401


def test_email_code_login_rejects_wrong_code(client: TestClient, monkeypatch) -> None:
    _setup(client)
    monkeypatch.setattr(auth_routes, "send_login_code", lambda email, code: None)
    client.cookies.clear()
    client.post("/api/auth/email-code", json={"email": OWNER["email"]})
    response = client.post(
        "/api/auth/email-login",
        json={"email": OWNER["email"], "code": "000000"},
    )
    assert response.status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_recovery_options_tells_if_code_exists(client: TestClient) -> None:
    setup = _setup(client)
    before = client.post("/api/auth/recovery-options", json={"email": OWNER["email"]})
    assert before.status_code == 200
    assert before.json()["has_recovery_code"] is False

    generated = client.post(
        "/api/auth/recovery-code",
        headers={"X-CSRF-Token": setup["csrf_token"]},
        json={"current_password": OWNER["password"]},
    )
    assert generated.status_code == 200

    after = client.post("/api/auth/recovery-options", json={"email": OWNER["email"]})
    assert after.status_code == 200
    assert after.json()["has_recovery_code"] is True
