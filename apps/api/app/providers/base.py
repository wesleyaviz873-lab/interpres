"""Provider abstractions shared by every LLM backend."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

ROLE_SYSTEM = "system"
ROLE_USER = "user"
ROLE_ASSISTANT = "assistant"


@dataclass
class ChatMessage:
    """A single message sent to an LLM."""

    role: str
    content: str


class ProviderError(Exception):
    """Raised when an LLM request fails."""


class BaseProvider(ABC):
    """Abstract interface every provider must implement."""

    key: str = ""
    suggested_models: tuple[str, ...] = ()

    @abstractmethod
    def chat(self, messages: list[ChatMessage], model: str) -> str:
        """Send a chat completion and return the assistant text."""

    def chat_stream(self, messages: list[ChatMessage], model: str):
        """Yield the assistant text in chunks as it is generated.

        The default implementation returns the whole response as a single
        chunk, so providers without streaming support still work. Providers
        that support streaming override this method.
        """
        yield self.chat(messages, model)
