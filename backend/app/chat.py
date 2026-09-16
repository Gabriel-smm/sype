"""Chat providers.

The scheduler itself never consults a model - see the note in `main.py`. Chat is
a separate surface where a model *would* help: turning "ethics paper, Friday,
worth 30%" into a task, or answering questions about the week.

No model is wired up yet. `EchoProvider` is the default and streams back a
deterministic reply, so the chat page is fully functional end to end today.
Adding a real model means writing one more `ChatProvider` and setting
`CHAT_PROVIDER` - the frontend does not change.

This module imports nothing from FastAPI or SQLAlchemy, like the other
decision-making modules.
"""
from __future__ import annotations

import os
import re
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

DEFAULT_MODEL = "claude-sonnet-5"


@dataclass(frozen=True)
class Message:
    role: str  # "user" | "assistant"
    content: str


@runtime_checkable
class ChatProvider(Protocol):
    """Anything that can turn a conversation into a stream of text chunks."""

    name: str

    def stream(self, messages: list[Message]) -> Iterator[str]:
        """Yield the reply in pieces. Pieces are concatenated by the client."""
        ...


# --- Fields a model would eventually extract -------------------------------
# Deliberately crude: this is placeholder behaviour that makes the echo reply
# concrete, not a substitute for the parsing a model will do.

_HOURS = re.compile(r"(\d+(?:\.\d+)?)\s*(?:h\b|hours?\b)", re.I)
_PERCENT = re.compile(r"(\d+(?:\.\d+)?)\s*%")
_WHEN = re.compile(
    r"\b(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|"
    r"next week|this week|\d{1,2}(?:st|nd|rd|th)?\s+\w+)\b",
    re.I,
)


def _skim(text: str) -> list[str]:
    found = []
    if match := _WHEN.search(text):
        found.append(f"due {match.group(1).lower()}")
    if match := _HOURS.search(text):
        found.append(f"about {match.group(1)} hours of work")
    if match := _PERCENT.search(text):
        found.append(f"{match.group(1)}% of the grade")
    return found


class EchoProvider:
    """Default provider. Streams a canned reply; no network, no key, no cost."""

    name = "echo"

    def __init__(self, delay: float = 0.0) -> None:
        self.delay = delay

    def stream(self, messages: list[Message]) -> Iterator[str]:
        import time

        last = next((m for m in reversed(messages) if m.role == "user"), None)
        text = last.content.strip() if last else ""

        reply = self._compose(text)
        # Word at a time, so the page can prove its streaming works.
        for index, word in enumerate(reply.split(" ")):
            if self.delay:
                time.sleep(self.delay)
            yield word if index == 0 else f" {word}"

    def _compose(self, text: str) -> str:
        if not text:
            return "Say something and I will read it back."

        skimmed = _skim(text)
        lines = [
            "There is no language model connected yet, so I cannot answer this "
            "properly - I can only show you what I heard.",
        ]
        if skimmed:
            lines.append(
                "From that message I picked out " + ", ".join(skimmed) + "."
            )
        lines.append(
            "Once a model is configured here, this is where it will turn a sentence "
            "like yours into a task, or explain why your week looks the way it does. "
            "Scheduling stays deterministic either way - the model only ever reads "
            "and writes tasks, it never decides where they land."
        )
        return "\n\n".join(lines)


class AnthropicProvider:
    """Ready for the day a key exists. Selected with CHAT_PROVIDER=anthropic.

    The SDK is imported lazily so this file stays importable without it
    installed (`pip install anthropic`).
    """

    name = "anthropic"

    SYSTEM = (
        "You help a university student manage their workload inside a task "
        "scheduler. Scheduling is deterministic and is not yours to decide: you "
        "read and write tasks, and explain the schedule the app produced. Be "
        "brief and concrete."
    )

    def __init__(self, model: str | None = None, api_key: str | None = None) -> None:
        self.model = model or os.environ.get("CHAT_MODEL", DEFAULT_MODEL)
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")

    def stream(self, messages: list[Message]) -> Iterator[str]:
        if not self.api_key:
            raise RuntimeError(
                "CHAT_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set."
            )
        try:
            import anthropic
        except ImportError as exc:  # pragma: no cover - depends on the environment
            raise RuntimeError(
                "CHAT_PROVIDER=anthropic needs the SDK: pip install anthropic"
            ) from exc

        client = anthropic.Anthropic(api_key=self.api_key)
        with client.messages.stream(
            model=self.model,
            max_tokens=1024,
            system=self.SYSTEM,
            messages=[{"role": m.role, "content": m.content} for m in messages],
        ) as stream:
            yield from stream.text_stream


PROVIDERS = {
    EchoProvider.name: lambda: EchoProvider(
        delay=float(os.environ.get("CHAT_ECHO_DELAY", "0.02"))
    ),
    AnthropicProvider.name: AnthropicProvider,
}


def get_provider() -> ChatProvider:
    """Pick a provider from CHAT_PROVIDER. Unknown names are an error, not a
    silent fallback - a typo should not look like a working config."""
    name = os.environ.get("CHAT_PROVIDER", EchoProvider.name).strip().lower()
    factory = PROVIDERS.get(name)
    if factory is None:
        raise RuntimeError(
            f"CHAT_PROVIDER={name!r} is not one of {sorted(PROVIDERS)}"
        )
    return factory()
