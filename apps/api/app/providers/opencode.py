"""OpenCode Go provider (https://opencode.ai/zen/go).

Go exposes three wire protocols behind a single ``oc_sk_...`` key, all under
the ``/zen/go/v1`` base and all requiring a stable ``x-opencode-session``
header (one id per conversation, used for routing/prompt caching):

- OpenAI chat completions -> ``POST /zen/go/v1/chat/completions`` (Bearer)
- OpenAI responses        -> ``POST /zen/go/v1/responses``       (Bearer)
- Anthropic messages      -> ``POST /zen/go/v1/messages``        (x-api-key)

Routing follows the endpoint table at https://opencode.ai/docs/go with an
automatic fallback: when a model answers ``ModelProtocolUnsupported`` on one
route, the other routes are tried before giving up.
"""

from __future__ import annotations

import json
import time
import uuid

import requests

from app.providers.base import BaseProvider, ChatMessage, ProviderError

BASE_URL = "https://opencode.ai/zen/go"
MODELS_URL = f"{BASE_URL}/v1/models"
CHAT_URL = f"{BASE_URL}/v1/chat/completions"
RESPONSES_URL = f"{BASE_URL}/v1/responses"
MESSAGES_URL = f"{BASE_URL}/v1/messages"

USER_AGENT = "Interpres/1.0"

#: Models shown before the live catalog is available (key not configured yet).
_SUGGESTED = (
    "glm-5.3-flash",
    "kimi-k2.7-code",
    "deepseek-v4-flash",
    "grok-4.6",
    "qwen3.8-flash",
    "minimax-m2.7",
    "mimo-v2.6-flash",
    "gpt-6-luna",
)

#: Exact wire protocol per model (from https://opencode.ai/docs/go#endpoints).
_ENDPOINTS = {
    # responses (OpenAI Responses API)
    "grok-4.7": "responses",
    "grok-4.6": "responses",
    "gpt-6-luna": "responses",
    "gpt-5.6-luna": "responses",
    "muse-spark-1.3-contributor": "responses",
    "muse-spark-1.2-contributor": "responses",
    # messages (Anthropic Messages API)
    "minimax-m3": "messages",
    "minimax-m2.7": "messages",
    "minimax-m2.5": "messages",
    "qwen3.8-max": "messages",
    "qwen3.8-flash": "messages",
    "qwen3.7-plus": "messages",
    "qwen3.7-max": "messages",
    "qwen3.6-plus": "messages",
}


def route_for(model: str) -> str:
    """Return the wire protocol for a Go model id."""
    name = (model or "").lower()
    if name in _ENDPOINTS:
        return _ENDPOINTS[name]
    if name.startswith("claude-"):
        return "messages"
    if name.startswith("gpt-") or name.startswith("muse-") or name.startswith("grok-"):
        return "responses"
    return "chat"


def _route_order(model: str) -> list[str]:
    """Preferred route first, then the remaining ones as fallback."""
    first = route_for(model)
    return [first] + [r for r in ("chat", "responses", "messages") if r != first]


#: Friendly display names (from https://opencode.ai/docs/go).
NAMES = {
    "grok-4.7": "Grok 4.7",
    "grok-4.6": "Grok 4.6",
    "gpt-6-luna": "GPT 6 Luna",
    "gpt-5.6-luna": "GPT 5.6 Luna",
    "glm-5.3-flash": "GLM 5.3 Flash",
    "glm-5.3": "GLM 5.3",
    "glm-5.2": "GLM 5.2",
    "glm-5.1": "GLM 5.1",
    "kimi-k3": "Kimi K3",
    "kimi-k2.7-code": "Kimi K2.7 Code",
    "kimi-k2.6": "Kimi K2.6",
    "longcat-2.0": "LongCat 2.0",
    "longcat-2.5-preview-free": "LongCat 2.5 Preview (free)",
    "deepseek-v4.1-flash": "DeepSeek V4.1 Flash",
    "deepseek-v4-pro": "DeepSeek V4 Pro",
    "deepseek-v4-flash": "DeepSeek V4 Flash",
    "deepseek-v4-flash-vision-exp": "DeepSeek V4 Flash Vision",
    "deepseek-flash": "DeepSeek Flash",
    "mimo-v2.6-flash": "MiMo V2.6 Flash",
    "mimo-v2.6-pro": "MiMo V2.6 Pro",
    "mimo-v2.5": "MiMo V2.5",
    "mimo-v2.5-pro": "MiMo V2.5 Pro",
    "minimax-m3": "MiniMax M3",
    "minimax-m2.7": "MiniMax M2.7",
    "minimax-m2.5": "MiniMax M2.5",
    "muse-spark-1.3-contributor": "Muse Spark 1.3",
    "muse-spark-1.2-contributor": "Muse Spark 1.2",
    "qwen3.8-max": "Qwen 3.8 Max",
    "qwen3.8-flash": "Qwen 3.8 Flash",
    "qwen3.7-max": "Qwen 3.7 Max",
    "qwen3.7-plus": "Qwen 3.7 Plus",
    "qwen3.6-plus": "Qwen 3.6 Plus",
    "hy4-preview": "Hy4 Preview",
    "hy3": "Hy3",
    "omen-alpha": "Omen Alpha",
    "space-bunny-free": "Space Bunny (free)",
}


def pretty_label(model: str) -> str:
    """Return a human-friendly display name for a model id."""
    if model in NAMES:
        return NAMES[model]
    name = model.removesuffix("-free").removesuffix("-contributor")
    # "claude-haiku-4-5" -> "Claude Haiku 4.5", "qwen3.8-max" -> "Qwen3.8 Max"
    parts = name.replace("_", "-").split("-")
    out: list[str] = []
    for part in parts:
        if not part:
            continue
        if part[0].isdigit() and len(out) and out[-1][-1].isdigit():
            out[-1] = f"{out[-1]}.{part}"  # 4 + 5 -> 4.5
        elif part in ("v1", "v2", "v3", "v4", "v5", "v6"):
            out.append(part.upper())
        elif part.lower() in ("gpt", "glm", "kimi", "qwen", "mimo", "glm".upper().lower()):
            out.append(part.upper() if len(part) <= 4 else part.capitalize())
        else:
            out.append(part[:1].upper() + part[1:])
    label = " ".join(out)
    if model.endswith("-free"):
        label += " (free)"
    return label


_FAMILY_LABELS = {
    "big-pickle": "Big Pickle",
    "space-bunny": "Space Bunny",
    "longcat": "LongCat",
    "grok-build": "Grok Build",
    "grok": "Grok",
    "muse-spark": "Muse Spark",
    "deepseek": "DeepSeek",
    "minimax": "MiniMax",
    "mimo": "MiMo",
    "nemotron": "Nemotron",
    "fledge": "Fledge",
    "qwen": "Qwen",
    "kimi": "Kimi",
    "glm": "GLM",
    "gpt": "GPT",
    "hy": "Hy",
    "omen": "Omen",
    "claude": "Claude",
    "gemini": "Gemini",
    "jev": "Jev",
}


def vendor_for(model: str) -> str:
    """Return a short family label used to group models in the UI."""
    import re as _re

    name = (model or "").lower().removesuffix("-free").removesuffix("-contributor")
    for family in sorted(_FAMILY_LABELS, key=len, reverse=True):
        if name == family or name.startswith(family + "-") or name.startswith(family + "_"):
            return _FAMILY_LABELS[family]
    # "qwen3.6-plus" -> "qwen", "hy3" -> "hy": tira versão grudada no nome.
    first = name.split("-", 1)[0] if "-" in name else name
    first = _re.sub(r"[\d.]+$", "", first)
    return _FAMILY_LABELS.get(first, first[:1].upper() + first[1:] if first else model)


def classify_zen_error(status: int, body: str) -> tuple[str, str]:
    """Map an HTTP failure to a (code, human message in pt-BR) pair."""
    text = (body or "")[:500]
    low = text.lower()
    # Ordem importa: "access is disabled" e freetier chegam como 403.
    if "model access is disabled" in low:
        return "disabled", "Modelo desabilitado para esta chave (sem acesso no plano atual)."
    if "freetier" in low or "free tier" in low:
        return "freetier", "Modelo gratuito restrito ao app OpenCode (não liberado via API)."
    if status == 410 or "endpoint is unavailable" in low:
        return "disabled", "Modelo indisponível no momento (endpoint fora do ar). Tente depois."
    if "missingsessionid" in low or "x-opencode-session" in low:
        return "provider_error", "Sessão Go ausente (erro interno: header x-opencode-session)."
    if "modelprotocolunsupported" in low or "does not support this protocol" in low:
        return "protocol", "Modelo usa outro protocolo (tentando rota alternativa…)."
    if status in (401, 403) or any(
        s in low for s in ("invalid_api_key", "invalid api key", "missing api key",
                           "incorrect api key", "unauthorized", "autherror", "auth_error")
    ):
        return "no_key", "Chave inválida ou ausente. Confira em Configurações → Chaves de API."
    if status == 402 or any(
        s in low for s in ("insufficient", "credit", "balance", "payment", "quota", "billing")
    ):
        return "no_credit", "Sem crédito na conta OpenCode. Recarregue em opencode.ai."
    if status == 404 or "not found" in low or "model_not_found" in low:
        return "not_found", "Modelo não encontrado no catálogo Go."
    if status == 429 or ("rate" in low and "limit" in low):
        return "rate_limited", "Limite de requisições atingido. Aguarde e tente de novo."
    if status >= 500 or "upstream" in low or "server_error" in low:
        return "provider_error", f"Provedor instável ({status}). Tente de novo em instantes."
    return "provider_error", f"Falha ({status}): {text[:160]}"


class _ProtocolError(ProviderError):
    """Internal: route mismatch, safe to retry on another protocol."""


class OpenCodeProvider(BaseProvider):
    """Chat via OpenCode Go, roteando para o protocolo certo por modelo."""

    key = "opencode"
    suggested_models = _SUGGESTED

    def __init__(self, api_key: str, timeout: int = 120, session: str | None = None) -> None:
        if not api_key or not api_key.strip():
            raise ProviderError(
                "Chave de API não configurada para o provedor 'opencode'. "
                "Defina-a na tela de configurações."
            )
        self._api_key = api_key.strip()
        self._timeout = timeout
        self._session = session or f"interpres-{uuid.uuid4().hex[:12]}"

    # ── headers ──────────────────────────────────────────
    def _bearer(self) -> dict:
        return {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json",
                "x-opencode-session": self._session, "User-Agent": USER_AGENT}

    def _anthropic_headers(self) -> dict:
        return {"x-api-key": self._api_key, "Content-Type": "application/json",
                "anthropic-version": "2023-06-01",
                "x-opencode-session": self._session, "User-Agent": USER_AGENT}

    def _raise(self, response: requests.Response, route: str) -> None:
        code, message = classify_zen_error(response.status_code, response.text)
        if code == "protocol":
            raise _ProtocolError(f"[protocol:{route}] {message}")
        raise ProviderError(f"[{code}] {message}")

    @staticmethod
    def _flat(messages: list[ChatMessage]) -> list[dict]:
        """Flatten ChatMessages to role/content dicts (tool -> user note)."""
        out = []
        for message in messages:
            role = message.role if message.role in ("system", "user", "assistant") else "user"
            content = message.content if isinstance(message.content, str) else json.dumps(message.content)
            if message.role not in ("system", "user", "assistant"):
                content = f"[resultado de ferramenta {message.role}]\n{content}"
            out.append({"role": role, "content": content})
        return out

    # ── BaseProvider API ─────────────────────────────────
    def chat(self, messages: list[ChatMessage], model: str) -> str:
        collected: list[str] = []
        for chunk in self.chat_stream(messages, model):
            collected.append(chunk)
        text = "".join(collected).strip()
        if not text:
            raise ProviderError("[provider_error] A API retornou uma resposta vazia.")
        return text

    def chat_stream(self, messages: list[ChatMessage], model: str):
        errors: list[str] = []
        for route in _route_order(model):
            try:
                if route == "chat":
                    yield from self._chat_stream(messages, model)
                elif route == "responses":
                    yield from self._responses_stream(messages, model)
                else:
                    yield from self._messages_stream(messages, model)
                return
            except _ProtocolError as exc:
                errors.append(str(exc))
                continue
        raise ProviderError(
            "[protocol] Modelo não respondeu em nenhum protocolo: " + " | ".join(errors))

    def _post(self, url: str, headers: dict, payload: dict, stream: bool):
        try:
            response = requests.post(url, headers=headers, json=payload,
                                     timeout=self._timeout, stream=stream)
        except requests.Timeout as exc:
            raise ProviderError("[timeout] Tempo esgotado aguardando o Go.") from exc
        except requests.RequestException as exc:
            raise ProviderError(f"[provider_error] Falha de rede: {exc}") from exc
        return response

    def _chat_stream(self, messages: list[ChatMessage], model: str):
        payload = {"model": model, "messages": self._flat(messages), "stream": True}
        response = self._post(CHAT_URL, self._bearer(), payload, stream=True)
        if response.status_code >= 400:
            self._raise(response, "chat")
        yield from _sse_text_deltas(response, kind="chat")

    def _responses_stream(self, messages: list[ChatMessage], model: str):
        payload = {"model": model, "input": self._flat(messages),
                   "max_output_tokens": 4096, "stream": True}
        response = self._post(RESPONSES_URL, self._bearer(), payload, stream=True)
        if response.status_code >= 400:
            self._raise(response, "responses")
        yield from _sse_text_deltas(response, kind="responses")

    def _messages_stream(self, messages: list[ChatMessage], model: str):
        flat = [m for m in self._flat(messages) if m["role"] != "system"]
        system = "\n".join(m["content"] for m in self._flat(messages) if m["role"] == "system") or None
        payload: dict = {"model": model, "max_tokens": 4096, "messages": flat, "stream": True}
        if system:
            payload["system"] = system
        response = self._post(MESSAGES_URL, self._anthropic_headers(), payload, stream=True)
        if response.status_code >= 400:
            self._raise(response, "messages")
        yield from _sse_text_deltas(response, kind="messages")

    # ── health check (verificador) ───────────────────────
    def ping(self, model: str, timeout: int = 25) -> dict:
        """Minimal request to check whether a model answers with this key.

        Tries the documented route first, then the other protocols.
        Returns ``{"ok", "ms", "code", "message"}``. Never raises.
        """
        started = time.perf_counter()
        last: dict = {"ok": False, "ms": 0, "code": "protocol",
                      "message": "Sem rota compatível."}
        old_timeout = self._timeout
        self._timeout = timeout
        try:
            for route in _route_order(model):
                try:
                    if route == "chat":
                        response = self._post(
                            CHAT_URL, self._bearer(),
                            {"model": model, "messages": [{"role": "user", "content": "ping"}],
                             "max_tokens": 1},
                            stream=False)
                    elif route == "responses":
                        response = self._post(
                            RESPONSES_URL, self._bearer(),
                            {"model": model, "input": "ping", "max_output_tokens": 16},
                            stream=False)
                    else:
                        response = self._post(
                            MESSAGES_URL, self._anthropic_headers(),
                            {"model": model, "max_tokens": 16,
                             "messages": [{"role": "user", "content": "ping"}]},
                            stream=False)
                except ProviderError as exc:
                    last = {"ok": False, "code": "timeout" if "[timeout]" in str(exc) else "provider_error",
                            "message": str(exc)[:200]}
                    break
                ms = int((time.perf_counter() - started) * 1000)
                if response.status_code < 400:
                    return {"ok": True, "ms": ms, "code": "ok",
                            "message": f"Respondendo ({ms}ms)."}
                code, message = classify_zen_error(response.status_code, response.text)
                last = {"ok": False, "ms": ms, "code": code, "message": message}
                if code != "protocol":
                    break
        except requests.RequestException as exc:
            last = {"ok": False, "ms": int((time.perf_counter() - started) * 1000),
                    "code": "provider_error", "message": f"Falha de rede: {exc}"}
        finally:
            self._timeout = old_timeout
        last["ms"] = last.get("ms") or int((time.perf_counter() - started) * 1000)
        return last


def _sse_text_deltas(response: requests.Response, kind: str):
    """Yield text deltas from an SSE stream for the three Go protocols."""
    for raw in response.iter_lines(decode_unicode=False):
        if not raw:
            continue
        text = raw.decode("utf-8", errors="replace").strip()
        if not text.startswith("data:"):
            continue
        payload = text[5:].strip()
        if not payload or payload == "[DONE]":
            continue
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            continue
        if kind == "chat":
            for choice in event.get("choices", []):
                delta = (choice.get("delta") or {}).get("content") or ""
                if delta:
                    yield delta
            if event.get("error"):
                raise ProviderError(f"[provider_error] {event['error']}")
        elif kind == "responses":
            etype = event.get("type", "")
            if etype in ("response.output_text.delta", "response.text.delta"):
                delta = event.get("delta", "")
                if isinstance(delta, dict):
                    delta = delta.get("text", "")
                if delta:
                    yield delta
            elif etype in ("response.failed", "response.incomplete"):
                err = event.get("response", {}).get("status_details") or event
                raise ProviderError(f"[provider_error] {json.dumps(err)[:200]}")
        else:  # messages (Anthropic SSE)
            if event.get("type") == "content_block_delta":
                delta = event.get("delta") or {}
                if delta.get("type") == "text_delta" and delta.get("text"):
                    yield delta["text"]
            elif event.get("type") == "error":
                raise ProviderError(f"[provider_error] {event.get('error', {})}")


def list_opencode_models(api_key: str | None = None) -> list[str]:
    """Return Go model ids. Authenticated = only models enabled for the key.

    Returns an empty list when the network fails.
    """
    headers = {"User-Agent": USER_AGENT, "x-opencode-session": "interpres-catalog"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    try:
        response = requests.get(MODELS_URL, headers=headers, timeout=12)
        response.raise_for_status()
        data = response.json().get("data", [])
        return [item["id"] for item in data if item.get("id")]
    except (requests.RequestException, ValueError):
        return []
