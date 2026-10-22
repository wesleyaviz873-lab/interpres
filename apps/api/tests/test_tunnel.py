from __future__ import annotations

from fastapi.testclient import TestClient

OWNER = {"email": "owner@example.com", "password": "correct-horse-battery"}


def _setup(client: TestClient) -> dict:
    response = client.post("/api/setup", json=OWNER)
    assert response.status_code == 201, response.text
    return response.json()


def test_tunnel_status_requires_auth(client: TestClient) -> None:
    assert client.get("/api/tunnel/status").status_code == 401


def test_tunnel_status_and_invalid_start(client: TestClient) -> None:
    setup = _setup(client)
    status = client.get("/api/tunnel/status")
    assert status.status_code == 200
    assert status.json()["running"] is False
    assert "cloudflare_quick" in status.json()["providers"]

    invalid = client.post(
        "/api/tunnel/start",
        headers={"X-CSRF-Token": setup["csrf_token"]},
        json={"provider": "unknown"},
    )
    assert invalid.status_code == 503

    stop = client.post(
        "/api/tunnel/stop",
        headers={"X-CSRF-Token": setup["csrf_token"]},
    )
    assert stop.status_code == 200


def test_tunnel_requires_csrf(client: TestClient) -> None:
    _setup(client)
    response = client.post("/api/tunnel/stop")
    assert response.status_code == 403
