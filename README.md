# Student Task Scheduler (MVP)

Schedules student work onto a week calendar with awareness of **grade impact**,
**self-reported stress** and **effort already invested**, and breaks long tasks
into manageable sessions.

**Core principle:** no LLM decides the schedule. Prioritisation, decomposition
and placement are all deterministic, unit-tested Python. (An LLM is only
envisaged later, for parsing natural-language task input into structured fields.)

```
Task input (form)
     ↓
[Rule-based decomposer]      essay -> research/outline/draft/revise
     ↓                       exam  -> spaced sessions at 10/6/3/1 days out
[Deterministic priority scorer]  weighted urgency / grade / stress / effort gap
     ↓
[Greedy scheduler]           walks free slots, respects fixed blocks,
     ↓                       matches high-focus work to productive hours
Week-view calendar
```

## Running it

Two processes. Backend first:

```bash
cd backend && ../.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Then the frontend (Vite proxies `/api` to port 8000):

```bash
npm run dev --prefix frontend
```

Open http://localhost:5173. The database is created and seeded with one test
student on first start. To load sample tasks as well:

```bash
cd backend && ../.venv/bin/python seed_demo.py
```

Interactive API docs: http://localhost:8000/docs

## The chat page

The fourth screen is a chat. **No model is connected**, and the app works without
one: `CHAT_PROVIDER` defaults to `echo`, which streams back a deterministic reply
naming the fields it recognised. The page says so rather than pretending.

Connecting a real model is one environment variable and one class:

```bash
pip install anthropic
export ANTHROPIC_API_KEY=...
export CHAT_PROVIDER=anthropic   # optionally CHAT_MODEL, default claude-sonnet-5
```

`AnthropicProvider` in `backend/app/chat.py` is already written against that path.
Any other provider is a class with a `stream(messages) -> Iterator[str]` method
added to `PROVIDERS`. The endpoint emits provider-independent server-sent events
(`delta` / `done` / `error`), so **the frontend does not change**.

Chat is not allowed near the schedule. It reads and writes tasks; placement stays
deterministic.

## Tests

```bash
cd backend && ../.venv/bin/python -m pytest -q
```

105 tests. The scoring, decomposition and scheduling modules are tested in
isolation (no DB, no HTTP); `test_api.py` covers the wired-together pipeline and
`test_chat.py` covers the provider contract and the event-stream format.

## Layout

| Path | What lives there |
| --- | --- |
| `backend/app/scoring.py` | `priority_score` and ranking. Pure functions. |
| `backend/app/decompose.py` | Essay-phase and exam-session rules. Pure functions. |
| `backend/app/scheduler.py` | Free-slot construction and greedy placement. Pure functions. |
| `backend/app/pipeline.py` | The only module that joins the above to SQLAlchemy. |
| `backend/app/models.py` | SQLAlchemy models. |
| `backend/app/chat.py` | Chat providers. Pure functions; no model wired up. |
| `backend/app/api/` | FastAPI routers. |
| `frontend/src/pages/` | The four screens: week, tasks, chat, parameters. |
| `frontend/src/components/` | Pieces shared between screens. |
| `frontend/src/lib/` | Week arithmetic and task vocabulary. |
| `frontend/src/theme.css` | The design tokens. Dark only. |

The three algorithm modules import nothing from FastAPI or SQLAlchemy, so the
scheduling logic can be reasoned about and tested on its own.

## Conventions worth knowing

- **Durations are minutes** everywhere in the API and database. The task form
  accepts hours and converts.
- **Fixed blocks and productive windows recur weekly.** `day_of_week` is
  `0`=Monday..`6`=Sunday, or `null` for every day. An `end_time` at or before
  `start_time` means the block runs overnight (sleep). Because they recur, a
  band that spills off Sunday night is drawn on Monday morning too.
- **Datetimes are naive local time.** Fine for a single-timezone test group;
  revisit before anyone travels.
- **The schedule is derived state.** Regenerating wipes and rebuilds all slots.
- **No auth.** Everything operates on student 1.

## Decisions taken beyond the brief

- **Phase precedence is enforced.** The brief's Section 6 algorithm ranks by
  score alone, which scheduled "revise" *before* the "draft" it revises whenever
  the draft was pushed late by the productive-hours constraint. Subtasks of a
  task now run in `order_index` order (`predecessor_ids` in `scheduler.py`).
  An unschedulable phase does not block the ones after it.
- **Overdue work is scheduled as soon as possible** rather than reported as
  unschedulable, since it cannot by definition be placed "before its due date"
  and would otherwise be buried. Toggle `SCHEDULE_OVERDUE_ASAP` in
  `scheduler.py` for strict Section 6 behaviour.
- **`effort_gap` is clamped to [0, 1]** so a task logged as over-worked
  contributes zero rather than a negative score.

## Known limitations

- **Long phases often do not fit.** The draft phase is 50% of an essay, so a
  10-hour essay needs one unbroken 5-hour block — which almost no student week
  contains. These surface as "unschedulable" with a reason rather than failing
  silently, but see the note below.
- Event log is written but never read — that is deliberate, it is future
  training data.
