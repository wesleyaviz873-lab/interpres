from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.models import Conversation, ConversationMessage
from app.providers.base import ProviderError
from app.routes import chat as chat_routes
from app.routes import projects as project_routes

OWNER = {"email": "owner@example.com", "password": "correct-horse-battery"}


def _setup(client: TestClient) -> dict:
    response = client.post("/api/setup", json=OWNER)
    assert response.status_code == 201, response.text
    return response.json()


def _headers(client: TestClient) -> dict[str, str]:
    me = client.get("/api/auth/me").json()
    return {"X-CSRF-Token": me["csrf_token"]}


def test_projects_accept_only_existing_folders(client: TestClient, monkeypatch) -> None:
    _setup(client)
    headers = _headers(client)

    missing = client.post("/api/projects", headers=headers, json={"path": "/nao/existe/123"})
    assert missing.status_code == 400

    folder = Path(tempfile.mkdtemp(prefix="interpres_project_"))
    created = client.post("/api/projects", headers=headers, json={"path": str(folder)})
    assert created.status_code == 200, created.text
    project = created.json()
    assert project["name"] == folder.name
    assert project["exists"] is True

    again = client.post("/api/projects", headers=headers, json={"path": str(folder)})
    assert again.json()["id"] == project["id"]

    listed = client.get("/api/projects").json()["projects"]
    assert [item["id"] for item in listed] == [project["id"]]

    picked_folder = Path(tempfile.mkdtemp(prefix="interpres_picked_"))

    class FakeDialog:
        returncode = 0
        stdout = f"{picked_folder}\n"

    monkeypatch.setattr(project_routes.subprocess, "run", lambda *a, **k: FakeDialog())
    picked = client.post("/api/projects/pick", headers=headers)
    assert picked.status_code == 200, picked.text
    assert picked.json()["cancelled"] is False
    assert picked.json()["project"]["path"] == str(picked_folder.resolve())
    assert len(client.get("/api/projects").json()["projects"]) == 2

    removed = client.delete(f"/api/projects/{project['id']}", headers=headers)
    assert removed.status_code == 200
    remaining = client.get("/api/projects").json()["projects"]
    assert [item["id"] for item in remaining] == [picked.json()["project"]["id"]]


def test_conversations_persist_and_respect_owner(client: TestClient) -> None:
    _setup(client)
    headers = _headers(client)

    folder = Path(tempfile.mkdtemp(prefix="interpres_chat_"))
    project = client.post("/api/projects", headers=headers, json={"path": str(folder)}).json()

    created = client.post(
        "/api/conversations",
        headers=headers,
        json={"project_id": project["id"]},
    )
    assert created.status_code == 200, created.text
    conversation = created.json()
    assert conversation["title"] == "Nova conversa"
    assert conversation["project_id"] == project["id"]

    renamed = client.patch(
        f"/api/conversations/{conversation['id']}",
        headers=headers,
        json={"title": "Planejamento"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Planejamento"
    assert renamed.json()["project_id"] == project["id"]

    read = client.get(f"/api/conversations/{conversation['id']}")
    assert read.status_code == 200
    assert read.json()["messages"] == []

    listed = client.get("/api/conversations").json()["conversations"]
    assert [item["id"] for item in listed] == [conversation["id"]]

    assert client.get("/api/conversations/desconhecida").status_code == 404
    assert client.delete("/api/conversations/desconhecida", headers=headers).status_code == 404

    deleted = client.delete(f"/api/conversations/{conversation['id']}", headers=headers)
    assert deleted.status_code == 200
    assert client.get("/api/conversations").json()["conversations"] == []


def test_chat_persists_both_turns(client: TestClient, monkeypatch) -> None:
    _setup(client)
    headers = _headers(client)

    client.put("/api/providers/opencode", headers=headers, json={"value": "oc-sk-test"})

    class FakeProvider:
        def __init__(self, api_key: str, **_kwargs) -> None:
            assert api_key == "oc-sk-test"

        def chat(self, messages, model):
            assert messages[-1].role == "user"
            assert messages[-1].content in {"oi", "tudo bem?"}
            return "Olá! 👋"

    monkeypatch.setattr(chat_routes, "OpenCodeProvider", FakeProvider)

    first = client.post(
        "/api/chat",
        headers=headers,
        json={
            "provider": "opencode",
            "model": "deepseek-v4.1-flash",
            "messages": [{"role": "user", "content": "oi"}],
        },
    )
    assert first.status_code == 200, first.text
    payload = first.json()
    assert payload["reply"] == "Olá! 👋"
    conversation_id = payload["conversation"]["id"]
    assert payload["conversation"]["title"] == "oi"
    assert payload["conversation"]["messages"] == 2

    second = client.post(
        "/api/chat",
        headers=headers,
        json={
            "provider": "opencode",
            "model": "deepseek-v4.1-flash",
            "messages": [{"role": "user", "content": "tudo bem?"}],
            "conversation_id": conversation_id,
        },
    )
    assert second.status_code == 200, second.text
    assert second.json()["conversation"]["messages"] == 4

    stored = client.get(f"/api/conversations/{conversation_id}").json()["messages"]
    assert [item["role"] for item in stored] == ["user", "assistant", "user", "assistant"]
    assert stored[1]["content"] == "Olá! 👋"

    db = SessionLocal()
    try:
        conversation = db.get(Conversation, conversation_id)
        assert conversation is not None
        assert conversation.model == "deepseek-v4.1-flash"
        assert db.query(ConversationMessage).count() == 4
    finally:
        db.close()


def test_chat_does_not_persist_other_users_conversation(client: TestClient) -> None:
    _setup(client)
    headers = _headers(client)
    client.put("/api/providers/opencode", headers=headers, json={"value": "oc-sk-test"})

    response = client.post(
        "/api/chat",
        headers=headers,
        json={
            "provider": "opencode",
            "model": "deepseek-v4.1-flash",
            "messages": [{"role": "user", "content": "oi"}],
            "conversation_id": "inexistente",
        },
    )
    assert response.status_code == 404


def test_chat_reports_provider_errors(client: TestClient, monkeypatch) -> None:
    _setup(client)
    headers = _headers(client)
    client.put("/api/providers/opencode", headers=headers, json={"value": "oc-sk-test"})

    class FailingProvider:
        def __init__(self, api_key: str, **_kwargs) -> None:
            pass

        def chat(self, messages, model):
            raise ProviderError("[no_credit] Sem crédito.")

    monkeypatch.setattr(chat_routes, "OpenCodeProvider", FailingProvider)

    response = client.post(
        "/api/chat",
        headers=headers,
        json={
            "provider": "opencode",
            "model": "deepseek-v4.1-flash",
            "messages": [{"role": "user", "content": "oi"}],
        },
    )
    assert response.status_code == 502


def test_chat_uses_selected_harness(client: TestClient, monkeypatch) -> None:
    _setup(client)
    headers = _headers(client)

    folder = Path(tempfile.mkdtemp(prefix="interpres_harness_"))
    project = client.post("/api/projects", headers=headers, json={"path": str(folder)}).json()

    calls: list[dict] = []

    def fake_run(harness_id, prompt, cwd, extra_env=None, timeout=600, files=None, session=None):
        calls.append({"id": harness_id, "prompt": prompt, "cwd": Path(cwd), "files": files})
        return {"ok": True, "exit_code": 0, "stdout": "arquivo criado", "stderr": ""}

    monkeypatch.setattr(chat_routes, "selected_harness", lambda _db: "opencode")
    monkeypatch.setattr(chat_routes, "run_harness", fake_run)

    response = client.post(
        "/api/chat",
        headers=headers,
        json={
            "provider": "opencode",
            "model": "deepseek-v4.1-flash",
            "messages": [{"role": "user", "content": "crie teste.txt"}],
            "project_id": project["id"],
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["harness"] == "opencode"
    assert response.json()["reply"] == "arquivo criado"
    assert calls[0]["id"] == "opencode"
    assert calls[0]["cwd"] == Path(project["path"])
    assert calls[0]["prompt"].startswith("PEDIDO DO USUÁRIO")
    assert "crie teste.txt" in calls[0]["prompt"]
    assert "acesso real" in calls[0]["prompt"]


def test_chat_reports_harness_failure(client: TestClient, monkeypatch) -> None:
    _setup(client)
    headers = _headers(client)

    monkeypatch.setattr(chat_routes, "selected_harness", lambda _db: "opencode")
    monkeypatch.setattr(
        chat_routes,
        "run_harness",
        lambda *a, **k: {"ok": False, "exit_code": 3, "stdout": "", "stderr": "sem login"},
    )

    response = client.post(
        "/api/chat",
        headers=headers,
        json={
            "provider": "opencode",
            "model": "deepseek-v4.1-flash",
            "messages": [{"role": "user", "content": "oi"}],
        },
    )
    assert response.status_code == 502
    assert "sem login" in response.json()["detail"]


def test_upload_saves_into_project_and_reaches_harness(client: TestClient, monkeypatch) -> None:
    _setup(client)
    headers = _headers(client)

    folder = Path(tempfile.mkdtemp(prefix="interpres_upload_"))
    project = client.post("/api/projects", headers=headers, json={"path": str(folder)}).json()

    uploaded = client.post(
        "/api/uploads",
        headers=headers,
        data={"project_id": project["id"]},
        files={"file": ("foto.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
    )
    assert uploaded.status_code == 200, uploaded.text
    info = uploaded.json()
    assert info["name"] == "foto.png"
    assert info["mime"] == "image/png"
    assert Path(info["path"]).is_file()
    assert (folder / ".interpres" / "uploads") in Path(info["path"]).parents

    captured: dict = {}

    def fake_run(harness_id, prompt, cwd, extra_env=None, timeout=600, files=None, session=None):
        captured["prompt"] = prompt
        captured["files"] = files
        return {"ok": True, "exit_code": 0, "stdout": "ok", "stderr": ""}

    monkeypatch.setattr(chat_routes, "selected_harness", lambda _db: "opencode")
    monkeypatch.setattr(chat_routes, "run_harness", fake_run)

    response = client.post(
        "/api/chat",
        headers=headers,
        json={
            "provider": "opencode",
            "model": "deepseek-v4.1-flash",
            "messages": [{"role": "user", "content": "descreva a foto"}],
            "project_id": project["id"],
            "attachments": [{"name": info["name"], "path": info["path"], "mime": info["mime"]}],
        },
    )
    assert response.status_code == 200, response.text
    assert captured["files"] == [info["path"]]
    assert captured["prompt"].startswith("PEDIDO DO USUÁRIO")
    assert "descreva a foto" in captured["prompt"]
    assert info["path"] in captured["prompt"]


def test_upload_rejects_foreign_paths(client: TestClient, monkeypatch) -> None:
    _setup(client)
    headers = _headers(client)

    captured: dict = {}

    def fake_run(harness_id, prompt, cwd, extra_env=None, timeout=600, files=None, session=None):
        captured["files"] = files
        return {"ok": True, "exit_code": 0, "stdout": "ok", "stderr": ""}

    monkeypatch.setattr(chat_routes, "selected_harness", lambda _db: "opencode")
    monkeypatch.setattr(chat_routes, "run_harness", fake_run)

    response = client.post(
        "/api/chat",
        headers=headers,
        json={
            "provider": "opencode",
            "model": "deepseek-v4.1-flash",
            "messages": [{"role": "user", "content": "oi"}],
            "attachments": [{"name": "x", "path": r"C:\Windows\win.ini", "mime": "text/plain"}],
        },
    )
    assert response.status_code == 200
    assert captured["files"] == []




def test_harness_session_is_reused_and_stored(client: TestClient, monkeypatch) -> None:
    _setup(client)
    headers = _headers(client)
    monkeypatch.setattr(chat_routes, "selected_harness", lambda _db: "hermes")

    calls: list[dict] = []

    def fake_run(harness_id, prompt, cwd, extra_env=None, timeout=600, files=None, session=None):
        calls.append({"prompt": prompt, "session": session, "files": files})
        return {"ok": True, "exit_code": 0, "stdout": "ok", "session": "sess-1"}

    monkeypatch.setattr(chat_routes, "run_harness", fake_run)

    first = client.post(
        "/api/chat",
        headers=headers,
        json={
            "provider": "opencode",
            "model": "deepseek-v4.1-flash",
            "messages": [{"role": "user", "content": "liste as pastas"}],
        },
    )
    assert first.status_code == 200, first.text
    conversation_id = first.json()["conversation"]["id"]
    assert calls[0]["session"] is None
    assert calls[0]["prompt"].startswith("PEDIDO DO USUÁRIO")

    second = client.post(
        "/api/chat",
        headers=headers,
        json={
            "provider": "opencode",
            "model": "deepseek-v4.1-flash",
            "messages": [{"role": "user", "content": "e agora?"}],
            "conversation_id": conversation_id,
        },
    )
    assert second.status_code == 200, second.text
    assert calls[1]["session"] == "sess-1"
    assert calls[1]["prompt"].startswith("e agora?")
    assert "PEDIDO DO USUÁRIO" not in calls[1]["prompt"]


def test_parse_question_marker() -> None:
    from app.routes.chat import _parse_question

    content, question = _parse_question(
        'Preciso de uma decisão.\n'
        '[[PERGUNTA]]{"question":"Qual banco?","options":["SQLite","Postgres"]}[[/PERGUNTA]]'
    )
    assert content == "Preciso de uma decisão."
    assert question == {"question": "Qual banco?", "options": ["SQLite", "Postgres"]}

    plain, none = _parse_question("Sem pergunta")
    assert plain == "Sem pergunta"
    assert none is None

    _, invalid = _parse_question("[[PERGUNTA]]nao e json[[/PERGUNTA]]")
    assert invalid is None


def test_chat_stores_question_card(client: TestClient, monkeypatch) -> None:
    _setup(client)
    headers = _headers(client)
    monkeypatch.setattr(chat_routes, "selected_harness", lambda _db: "opencode")

    def fake_run(harness_id, prompt, cwd, extra_env=None, timeout=600, files=None, session=None):
        return {
            "ok": True,
            "exit_code": 0,
            "stdout": 'Qual opção?[[PERGUNTA]]{"question":"Qual opção?","options":["A","B"]}[[/PERGUNTA]]',
            "stderr": "",
            "session": "",
        }

    monkeypatch.setattr(chat_routes, "run_harness", fake_run)

    response = client.post(
        "/api/chat",
        headers=headers,
        json={
            "provider": "opencode",
            "model": "deepseek-v4.1-flash",
            "messages": [{"role": "user", "content": "preciso escolher"}],
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["question"] == {"question": "Qual opção?", "options": ["A", "B"]}
    assert payload["reply"] == "Qual opção?"

    read = client.get(f"/api/conversations/{payload['conversation']['id']}").json()
    assistant = read["messages"][-1]
    assert assistant["question"] == {"question": "Qual opção?", "options": ["A", "B"]}
