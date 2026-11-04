from __future__ import annotations

from fastapi.testclient import TestClient

OWNER = {"email": "owner@example.com", "password": "correct-horse-battery"}


def _setup(client: TestClient) -> dict:
    response = client.post("/api/setup", json=OWNER)
    assert response.status_code == 201, response.text
    return response.json()


def _headers(client: TestClient) -> dict[str, str]:
    return {"X-CSRF-Token": client.get("/api/auth/me").json()["csrf_token"]}


def test_memory_status(client: TestClient) -> None:
    _setup(client)
    response = client.get("/api/system/memory")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total_mb"] > 0
    assert 0 <= data["percent"] <= 100
    assert isinstance(data["top"], list)
    ids = {item["id"] for item in data["targets"]}
    assert {"wsl", "opencode-desktop", "chatgpt"} <= ids


def test_memory_policy_roundtrip(client: TestClient) -> None:
    _setup(client)
    headers = _headers(client)
    saved = client.put(
        "/api/system/memory/policy",
        headers=headers,
        json={"auto": True, "threshold_mb": 2048, "targets": ["chatgpt", "wsl", "invalido"]},
    )
    assert saved.status_code == 200, saved.text
    assert saved.json() == {
        "auto": True,
        "threshold_mb": 2048,
        "targets": ["chatgpt", "wsl"],
    }
    read = client.get("/api/system/memory/policy").json()
    assert read == saved.json()

    client.put(
        "/api/system/memory/policy",
        headers=headers,
        json={"auto": False, "threshold_mb": 1500, "targets": ["chatgpt"]},
    )


def test_free_memory_without_targets(client: TestClient) -> None:
    _setup(client)
    headers = _headers(client)
    response = client.post(
        "/api/system/memory/free",
        headers=headers,
        json={"targets": []},
    )
    assert response.status_code == 200, response.text
    assert response.json()["actions"] == []


def test_memory_requires_auth(client: TestClient) -> None:
    assert client.get("/api/system/memory").status_code == 401
