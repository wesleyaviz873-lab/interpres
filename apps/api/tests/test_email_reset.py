from __future__ import annotations

from fastapi.testclient import TestClient

from app.routes import auth as auth_routes

OWNER = {"email": "owner@example.com", "password": "correct-horse-battery"}
NEW_PASSWORD = "email-reset-password-123"


def test_recovery_methods_reports_email(client: TestClient) -> None:
    response = client.get("/api/auth/recovery-methods")
    assert response.status_code == 200
    assert response.json()["email"] is True


def test_forgot_password_sends_code_and_reset_logs_in(
    client: TestClient, monkeypatch
) -> None:
    setup = client.post("/api/setup", json=OWNER)
    assert setup.status_code == 201
    csrf = setup.json()["csrf_token"]
    generated = client.post(
        "/api/auth/recovery-code",
        headers={"X-CSRF-Token": csrf},
        json={"current_password": OWNER["password"]},
    )
    assert generated.status_code == 200
    old_recovery = generated.json()["recovery_code"]

    captured: dict[str, str] = {}

    def fake_send(email: str, code: str) -> None:
        captured["email"] = email
        captured["code"] = code

    monkeypatch.setattr(auth_routes, "send_password_reset_code", fake_send)

    forgot = client.post("/api/auth/forgot-password", json={"email": OWNER["email"]})
    assert forgot.status_code == 200, forgot.text
    assert captured["email"] == OWNER["email"]
    assert len(captured["code"]) == 6

    client.cookies.clear()
    reset = client.post(
        "/api/auth/reset-password",
        json={
            "email": OWNER["email"],
            "code": captured["code"],
            "new_password": NEW_PASSWORD,
        },
    )
    assert reset.status_code == 200, reset.text
    body = reset.json()
    assert body["recovery_code"] != old_recovery
    assert client.get("/api/auth/me").status_code == 200

    client.cookies.clear()
    old = client.post(
        "/api/auth/login",
        json={"email": OWNER["email"], "password": OWNER["password"]},
    )
    assert old.status_code == 401
    new = client.post(
        "/api/auth/login",
        json={"email": OWNER["email"], "password": NEW_PASSWORD},
    )
    assert new.status_code == 200


def test_forgot_password_does_not_reveal_unknown_email(
    client: TestClient, monkeypatch
) -> None:
    calls: list[str] = []

    def fake_send(email: str, code: str) -> None:
        calls.append(email)

    monkeypatch.setattr(auth_routes, "send_password_reset_code", fake_send)

    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "nobody@example.com"},
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert calls == []


def test_reset_password_rejects_wrong_code(client: TestClient, monkeypatch) -> None:
    client.post("/api/setup", json=OWNER)
    monkeypatch.setattr(
        auth_routes,
        "send_password_reset_code",
        lambda email, code: None,
    )
    client.post("/api/auth/forgot-password", json={"email": OWNER["email"]})
    response = client.post(
        "/api/auth/reset-password",
        json={
            "email": OWNER["email"],
            "code": "000000",
            "new_password": NEW_PASSWORD,
        },
    )
    assert response.status_code == 401

