"""Chat endpoint. Streams a reply as server-sent events.

The wire format is provider-independent so the frontend never learns which
model (if any) is behind it:

    data: {"type": "delta", "text": "..."}
    data: {"type": "done"}
    data: {"type": "error", "message": "..."}
"""
import json
from collections.abc import Iterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..chat import Message, get_provider
from ..db import get_db

router = APIRouter(prefix="/api/students", tags=["chat"])


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _events(messages: list[Message]) -> Iterator[str]:
    try:
        provider = get_provider()
        for chunk in provider.stream(messages):
            yield _sse({"type": "delta", "text": chunk})
    except Exception as exc:  # surfaced in the transcript rather than a dead stream
        yield _sse({"type": "error", "message": str(exc)})
    else:
        yield _sse({"type": "done"})


@router.post("/{student_id}/chat")
def chat(student_id: int, payload: schemas.ChatRequest, db: Session = Depends(get_db)):
    if db.get(models.Student, student_id) is None:
        raise HTTPException(404, f"No student {student_id}")

    messages = [Message(role=m.role, content=m.content) for m in payload.messages]
    if not messages:
        raise HTTPException(422, "messages must not be empty")

    return StreamingResponse(
        _events(messages),
        media_type="text/event-stream",
        # Proxies buffer event streams by default, which looks like a hang.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{student_id}/chat/provider")
def provider_info(student_id: int, db: Session = Depends(get_db)):
    """What is answering. The chat page shows this so nobody mistakes the
    placeholder for a real model."""
    if db.get(models.Student, student_id) is None:
        raise HTTPException(404, f"No student {student_id}")
    try:
        provider = get_provider()
    except RuntimeError as exc:
        return {"name": "unconfigured", "live": False, "detail": str(exc)}
    return {"name": provider.name, "live": provider.name != "echo", "detail": ""}
