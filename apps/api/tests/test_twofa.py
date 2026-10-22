from __future__ import annotations

import pyotp
from fastapi.testclient import TestClient

OWNER = {"email": "owner@example.com", "password": "correct-horse-battery"}


def _setup(client: TestClient) -> dict:
    response = client.post("/api/setup", json=OWNER)
    assert response.status_code == 201, response.text
    return response.json()


def _login_challenge(client: TestClient) -> dict:
    client.cookies.clear()
    response = client.post("/api/auth/login", json=OWNER)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data.get("requires_2fa") is True
    return data


def test_two_factor_setup_enable_login_and_disable(client: TestClient) -> None:
    setup = _setup(client)
    csrf = setup["csrf_token"]

    status_before = client.get("/api/auth/2fa/status")
    assert status_before.json()["enabled"] is False

    started = client.post(
        "/api/auth/2fa/setup",
        headers={"X-CSRF-Token": csrf},
    )
    assert started.status_code == 200, started.text
    body = started.json()
    secret = body["secret"]
    assert body["qr_data_url"].startswith("data:image/png;base64,")
    assert body["otpauth_uri"].startswith("otpauth://totp/")

    code = pyotp.TOTP(secret).now()
    enabled = client.post(
        "/api/auth/2fa/enable",
        headers={"X-CSRF-Token": csrf},
        json={"code": code},
    )
    assert enabled.status_code == 200, enabled.text
    backup_codes = enabled.json()["backup_codes"]
    assert len(backup_codes) == 8

    status = client.get("/api/auth/2fa/status")
    assert status.json() == {"enabled": True, "backup_codes_remaining": 8}

    challenge = _login_challenge(client)
    logged = client.post(
        "/api/auth/login/2fa",
        json={
            "challenge_token": challenge["challenge_token"],
            "code": pyotp.TOTP(secret).now(),
        },
    )
    assert logged.status_code == 200, logged.text
    csrf2 = logged.json()["csrf_token"]
    assert client.get("/api/auth/me").status_code == 200

    disabled = client.post(
        "/api/auth/2fa/disable",
        headers={"X-CSRF-Token": csrf2},
        json={
            "current_password": OWNER["password"],
            "code": pyotp.TOTP(secret).now(),
        },
    )
    assert disabled.status_code == 200, disabled.text
    assert client.get("/api/auth/2fa/status").json()["enabled"] is False


def test_backup_code_can_be_used_once(client: TestClient) -> None:
    setup = _setup(client)
    csrf = setup["csrf_token"]
    started = client.post("/api/auth/2fa/setup", headers={"X-CSRF-Token": csrf})
    secret = started.json()["secret"]
    enabled = client.post(
        "/api/auth/2fa/enable",
        headers={"X-CSRF-Token": csrf},
        json={"code": pyotp.TOTP(secret).now()},
    )
    backup = enabled.json()["backup_codes"][0]

    challenge = _login_challenge(client)
    first = client.post(
        "/api/auth/login/2fa",
        json={"challenge_token": challenge["challenge_token"], "code": backup},
    )
    assert first.status_code == 200, first.text
    status = client.get("/api/auth/2fa/status")
    assert status.json()["backup_codes_remaining"] == 7

    challenge = _login_challenge(client)
    second = client.post(
        "/api/auth/login/2fa",
        json={"challenge_token": challenge["challenge_token"], "code": backup},
    )
    assert second.status_code == 401


def test_two_factor_wrong_code_does_not_create_session(client: TestClient) -> None:
    setup = _setup(client)
    csrf = setup["csrf_token"]
    started = client.post("/api/auth/2fa/setup", headers={"X-CSRF-Token": csrf})
    secret = started.json()["secret"]
    client.post(
        "/api/auth/2fa/enable",
        headers={"X-CSRF-Token": csrf},
        json={"code": pyotp.TOTP(secret).now()},
    )

    challenge = _login_challenge(client)
    bad = client.post(
        "/api/auth/login/2fa",
        json={"challenge_token": challenge["challenge_token"], "code": "000000"},
    )
    assert bad.status_code == 401
    assert client.get("/api/auth/me").status_code == 401
