from __future__ import annotations

from fastapi.testclient import TestClient

OWNER = {"email": "owner@example.com", "password": "correct-horse-battery"}


def _setup(client: TestClient) -> dict:
    response = client.post("/api/setup", json=OWNER)
    assert response.status_code == 201, response.text
    return response.json()


def test_devices_list_and_revoke_another_session(client: TestClient) -> None:
    setup = _setup(client)
    csrf = setup["csrf_token"]

    first = client.get("/api/auth/devices")
    assert first.status_code == 200
    assert len(first.json()["devices"]) == 1
    assert first.json()["devices"][0]["current"] is True

    other = TestClient(client.app)
    login = other.post("/api/auth/login", json=OWNER)
    assert login.status_code == 200

    two = client.get("/api/auth/devices").json()["devices"]
    assert len(two) == 2
    other_device = next(device for device in two if not device["current"])
    assert other_device["label"]

    revoked = client.delete(
        f"/api/auth/devices/{other_device['id']}",
        headers={"X-CSRF-Token": csrf},
    )
    assert revoked.status_code == 200
    assert other.get("/api/auth/me").status_code == 401
    assert len(client.get("/api/auth/devices").json()["devices"]) == 1


def test_revoking_current_device_logs_out(client: TestClient) -> None:
    setup = _setup(client)
    current = client.get("/api/auth/devices").json()["devices"][0]
    response = client.delete(
        f"/api/auth/devices/{current['id']}",
        headers={"X-CSRF-Token": setup["csrf_token"]},
    )
    assert response.status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_devices_require_auth_and_csrf(client: TestClient) -> None:
    assert client.get("/api/auth/devices").status_code == 401
    setup = _setup(client)
    current = client.get("/api/auth/devices").json()["devices"][0]
    no_csrf = client.delete(f"/api/auth/devices/{current['id']}")
    assert no_csrf.status_code == 403
