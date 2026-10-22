from __future__ import annotations

from fastapi.testclient import TestClient

from app.crypto import decrypt_secret
from app.database import SessionLocal
from app.models import ProviderKey

OWNER = {"email": "owner@example.com", "password": "correct-horse-battery"}


def _setup(client: TestClient) -> dict:
    response = client.post("/api/setup", json=OWNER)
    assert response.status_code == 201, response.text
    return response.json()


def test_provider_keys_are_encrypted_and_masked(client: TestClient) -> None:
    setup = _setup(client)
    csrf = setup["csrf_token"]

    before = client.get("/api/providers")
    assert before.status_code == 200
    assert all(not item["configured"] for item in before.json()["providers"])

    saved = client.put(
        "/api/providers/openai",
        headers={"X-CSRF-Token": csrf},
        json={"value": "sk-test-secret"},
    )
    assert saved.status_code == 200, saved.text

    after = client.get("/api/providers").json()["providers"]
    openai = next(item for item in after if item["id"] == "openai")
    assert openai["configured"] is True
    assert openai["hint"] == "Configurada"
    assert "sk-test-secret" not in str(after)

    db = SessionLocal()
    try:
        row = db.get(ProviderKey, "openai")
        assert row is not None
        assert row.encrypted_value != "sk-test-secret"
        assert decrypt_secret(row.encrypted_value) == "sk-test-secret"
    finally:
        db.close()

    deleted = client.delete(
        "/api/providers/openai",
        headers={"X-CSRF-Token": csrf},
    )
    assert deleted.status_code == 200
    after_delete = client.get("/api/providers").json()["providers"]
    assert next(item for item in after_delete if item["id"] == "openai")["configured"] is False


def test_provider_requires_session_and_csrf(client: TestClient) -> None:
    assert client.get("/api/providers").status_code == 401

    setup = _setup(client)
    missing_csrf = client.put(
        "/api/providers/openai",
        json={"value": "sk-test-secret"},
    )
    assert missing_csrf.status_code == 403
    assert setup["user"]["email"] == OWNER["email"]


def test_invalid_provider_and_ollama_url(client: TestClient) -> None:
    setup = _setup(client)
    csrf = setup["csrf_token"]

    unknown = client.put(
        "/api/providers/unknown",
        headers={"X-CSRF-Token": csrf},
        json={"value": "x"},
    )
    assert unknown.status_code == 404

    bad_url = client.put(
        "/api/providers/ollama",
        headers={"X-CSRF-Token": csrf},
        json={"value": "not-a-url"},
    )
    assert bad_url.status_code == 400


def test_ollama_discovery_and_agents_are_read_only(client: TestClient) -> None:
    _setup(client)
    ollama = client.get("/api/providers/ollama/models")
    assert ollama.status_code == 200
    assert "reachable" in ollama.json()
    assert isinstance(ollama.json()["models"], list)

    agents = client.get("/api/agents")
    assert agents.status_code == 200
    assert all("installed" in agent for agent in agents.json()["agents"])
