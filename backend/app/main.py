"""FastAPI entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import chat, events, schedule, students, tasks
from .models import BLOCK_KINDS, EVENT_TYPES, TASK_TYPES
from .seed import bootstrap

@asynccontextmanager
async def lifespan(_app: FastAPI):
    bootstrap()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Student Task Scheduler",
    version="0.1.0",
    description=(
        "Grade-, stress- and procrastination-aware task scheduling. "
        "All prioritisation and scheduling is deterministic rule-based code; "
        "no LLM participates in any scheduling decision."
    ),
)

# Vite dev server runs on a different port during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students.router)
app.include_router(tasks.router)
app.include_router(schedule.router)
app.include_router(events.router)
app.include_router(chat.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/meta")
def meta() -> dict:
    """Vocabulary the frontend needs to build its dropdowns."""
    return {
        "task_types": TASK_TYPES,
        "block_kinds": BLOCK_KINDS,
        "event_types": EVENT_TYPES,
        "default_student_id": 1,
    }
