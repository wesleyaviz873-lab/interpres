from __future__ import annotations

import re

from fastapi.testclient import TestClient

OWNER = {"email": "owner@example.com", "password": "correct-horse-battery"}
NEW_PASSWORD = "new-correct-horse-battery"
RECOVERY_PATTERN = re.compile(r"^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$")


def _setup(client: TestClient) -> dict:
    response = client.post("/api/setup", json=OWNER)
    assert response.status_code == 201, response.text
    return response.json()


def _login(client: TestClient, email: str = OWNER["email"], password: str = OWNER["password"]) -> dict:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()


def _generate_recovery_code(
    client: TestClient,
    csrf: str,
    password: str = OWNER["password"],
) -> str:
    response = client.post(
        "/api/auth/recovery-code",
        headers={"X-CSRF-Token": csrf},
        json={"current_password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()["recovery_code"]


def _cookie(client: TestClient) -> str:
    cookie = client.cookies.get("interpres_session")
    assert cookie
    return cookie


def test_health_is_public(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_setup_status_is_true_on_empty_install(client: TestClient) -> None:
    response = client.get("/api/setup/status")
    assert response.status_code == 200
    assert response.json() == {"needs_setup": True}


def test_setup_creates_owner_and_session_without_recovery_code(client: TestClient) -> None:
    data = _setup(client)
    assert data["user"]["email"] == "owner@example.com"
    assert len(data["csrf_token"]) > 20
    assert "recovery_code" not in data
    assert client.cookies.get("interpres_session")

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "owner@example.com"
    assert me.json()["has_recovery_code"] is False

    code = _generate_recovery_code(client, data["csrf_token"])
    assert RECOVERY_PATTERN.match(code)
    assert client.get("/api/auth/me").json()["has_recovery_code"] is True


def test_setup_normalizes_email(client: TestClient) -> None:
    response = client.post(
        "/api/setup",
        json={"email": "Owner@Example.COM", "password": "correct-horse-battery"},
    )
    assert response.status_code == 201
    assert response.json()["user"]["email"] == "owner@example.com"


def test_setup_refuses_second_owner(client: TestClient) -> None:
    _setup(client)
    response = client.post(
        "/api/setup",
        json={"email": "second@example.com", "password": "another-long-password"},
    )
    assert response.status_code == 409


def test_setup_rejects_short_password(client: TestClient) -> None:
    response = client.post(
        "/api/setup",
        json={"email": "owner@example.com", "password": "short"},
    )
    assert response.status_code == 422


def test_protected_route_requires_session(client: TestClient) -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_login_and_logout_flow(client: TestClient) -> None:
    _setup(client)

    client.cookies.clear()
    wrong = client.post(
        "/api/auth/login",
        json={"email": OWNER["email"], "password": "wrong-password"},
    )
    assert wrong.status_code == 401

    login = _login(client)
    csrf = login["csrf_token"]

    no_csrf = client.post("/api/auth/logout")
    assert no_csrf.status_code == 403

    logout = client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    assert logout.status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_recovery_rotates_code_and_invalidates_old_sessions(client: TestClient) -> None:
    setup = _setup(client)
    old_code = _generate_recovery_code(client, setup["csrf_token"])
    old_cookie = _cookie(client)

    client.cookies.clear()
    recovered = client.post(
        "/api/auth/recover",
        json={
            "email": OWNER["email"],
            "recovery_code": old_code,
            "new_password": NEW_PASSWORD,
        },
    )
    assert recovered.status_code == 200, recovered.text
    body = recovered.json()
    assert body["recovery_code"] != old_code
    assert RECOVERY_PATTERN.match(body["recovery_code"])

    old_session = TestClient(client.app)
    old_session.cookies.set("interpres_session", old_cookie)
    assert old_session.get("/api/auth/me").status_code == 401

    old_login = client.post(
        "/api/auth/login",
        json={"email": OWNER["email"], "password": OWNER["password"]},
    )
    assert old_login.status_code == 401
    _login(client, password=NEW_PASSWORD)

    reused = client.post(
        "/api/auth/recover",
        json={
            "email": OWNER["email"],
            "recovery_code": old_code,
            "new_password": "another-password-123",
        },
    )
    assert reused.status_code == 401


def test_change_password_keeps_current_session_and_drops_others(client: TestClient) -> None:
    setup = _setup(client)
    first_cookie = _cookie(client)

    client.cookies.clear()
    login = _login(client)
    csrf = login["csrf_token"]

    other = TestClient(client.app)
    other.cookies.set("interpres_session", first_cookie)
    assert other.get("/api/auth/me").status_code == 200

    changed = client.post(
        "/api/auth/change-password",
        headers={"X-CSRF-Token": csrf},
        json={"current_password": OWNER["password"], "new_password": NEW_PASSWORD},
    )
    assert changed.status_code == 200, changed.text

    assert client.get("/api/auth/me").status_code == 200
    assert other.get("/api/auth/me").status_code == 401

    old_login = client.post(
        "/api/auth/login",
        json={"email": OWNER["email"], "password": OWNER["password"]},
    )
    assert old_login.status_code == 401
    assert setup["user"]["email"] == OWNER["email"]


def test_change_password_rejects_wrong_current_password(client: TestClient) -> None:
    setup = _setup(client)
    response = client.post(
        "/api/auth/change-password",
        headers={"X-CSRF-Token": setup["csrf_token"]},
        json={"current_password": "wrong-password", "new_password": NEW_PASSWORD},
    )
    assert response.status_code == 401


def test_change_email(client: TestClient) -> None:
    setup = _setup(client)
    response = client.post(
        "/api/auth/change-email",
        headers={"X-CSRF-Token": setup["csrf_token"]},
        json={"current_password": OWNER["password"], "new_email": "New@Example.com"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["user"]["email"] == "new@example.com"

    client.cookies.clear()
    _login(client, email="new@example.com")


def test_rotate_recovery_code_invalidates_previous_code(client: TestClient) -> None:
    setup = _setup(client)
    old_code = _generate_recovery_code(client, setup["csrf_token"])

    rotated = client.post(
        "/api/auth/recovery-code",
        headers={"X-CSRF-Token": setup["csrf_token"]},
        json={"current_password": OWNER["password"]},
    )
    assert rotated.status_code == 200, rotated.text
    new_code = rotated.json()["recovery_code"]
    assert new_code != old_code

    client.cookies.clear()
    old = client.post(
        "/api/auth/recover",
        json={
            "email": OWNER["email"],
            "recovery_code": old_code,
            "new_password": NEW_PASSWORD,
        },
    )
    assert old.status_code == 401

    new = client.post(
        "/api/auth/recover",
        json={
            "email": OWNER["email"],
            "recovery_code": new_code,
            "new_password": NEW_PASSWORD,
        },
    )
    assert new.status_code == 200, new.text


def test_logout_all_invalidates_every_session(client: TestClient) -> None:
    setup = _setup(client)
    first_cookie = _cookie(client)

    client.cookies.clear()
    login = _login(client)
    csrf = login["csrf_token"]

    other = TestClient(client.app)
    other.cookies.set("interpres_session", first_cookie)
    assert other.get("/api/auth/me").status_code == 200

    response = client.post("/api/auth/logout-all", headers={"X-CSRF-Token": csrf})
    assert response.status_code == 200
    assert client.get("/api/auth/me").status_code == 401
    assert other.get("/api/auth/me").status_code == 401
    assert setup["user"]["email"] == OWNER["email"]


def test_login_rate_limit(client: TestClient) -> None:
    for _ in range(10):
        response = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401
    blocked = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "wrong-password"},
    )
    assert blocked.status_code == 429


def test_security_headers(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert "content-security-policy" in response.headers


