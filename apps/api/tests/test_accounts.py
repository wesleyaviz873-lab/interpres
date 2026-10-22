from __future__ import annotations

from fastapi.testclient import TestClient

from app.accounts import find_user_by_email, reset_password
from app.database import SessionLocal

OWNER = {"email": "owner@example.com", "password": "correct-horse-battery"}


def test_admin_reset_rotates_code_and_revokes_sessions(client: TestClient) -> None:
    setup = client.post("/api/setup", json=OWNER)
    assert setup.status_code == 201
    old_code = setup.json()["recovery_code"]

    db = SessionLocal()
    try:
        user, new_code = reset_password(db, OWNER["email"], "admin-reset-password-123")
        assert user is not None
        assert new_code and new_code != old_code
        assert find_user_by_email(db, OWNER["email"]) is not None
    finally:
        db.close()

    assert client.get("/api/auth/me").status_code == 401

    old_login = client.post(
        "/api/auth/login",
        json={"email": OWNER["email"], "password": OWNER["password"]},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/auth/login",
        json={"email": OWNER["email"], "password": "admin-reset-password-123"},
    )
    assert new_login.status_code == 200

    client.cookies.clear()
    old_recovery = client.post(
        "/api/auth/recover",
        json={
            "email": OWNER["email"],
            "recovery_code": old_code,
            "new_password": "another-password-123",
        },
    )
    assert old_recovery.status_code == 401
