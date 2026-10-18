# Sype

**A week planner for students that decides what to work on next, and shows its reasoning.**

[![CI](https://github.com/Gabriel-smm/sype/actions/workflows/ci.yml/badge.svg)](https://github.com/Gabriel-smm/sype/actions/workflows/ci.yml)

Sype puts academic deadlines and everyday routine (gym, laundry, chores) on one calendar. It
weighs each task by **how soon it's due**, **how much of the grade it's worth**, **how stressed
you are about it**, and **how much work is left**. Then it splits big assignments into sessions
and fits them into the free time around your classes and sleep.

## Features

- **Priority you can inspect.** Every task gets a transparent, weighted score, and you can tune
  the weights and preview the effect before saving.
- **Automatic breakdown.** Long essays become research → outline → draft → revise, in order.
  Exams become spaced study sessions 10, 6, 3 and 1 days out.
- **Fits your actual week.** Fixed blocks (classes, meals, sleep) are respected, and focus-heavy
  work goes into the hours you say you're sharpest.
- **Routine included.** Recurring tasks roll forward every week and share the calendar with
  deadline work.
- **Honest about limits.** Work that can't fit before its deadline is flagged with a reason, not
  silently dropped.
- **Quick capture.** Type `HIST essay fri 5pm 4h 20%` and it's parsed into a task, with every
  guess shown back so you can correct it.

## Deterministic by design

No language model decides your schedule. Prioritisation, decomposition and placement are plain,
unit-tested rules, so the same inputs always give the same week:

```
Tasks + recurring routine
        ↓
Decompose  →  Score  →  Place into free time  →  Week calendar
```

An optional chat assistant can help you capture tasks. It is off by default (an offline stub)
and never touches placement.

## Quick start

Requires Python 3.12 and Node.js 20+.

```bash
git clone https://github.com/Gabriel-smm/sype.git
cd sype
./dev.sh --seed
```

Open **http://localhost:5173**. The API docs are at http://localhost:8000/docs.

## Tech stack

| Layer | Tools |
|---|---|
| Backend | Python 3.12 · FastAPI · SQLAlchemy · Pydantic · SQLite |
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS 4 · Radix UI |
| Testing | pytest · Vitest · oxlint · GitHub Actions |

## Documentation

| Doc | What's inside |
|---|---|
| [Setup & operation](docs/setup.md) | Install, run, environment variables, checks |
| [Architecture](docs/architecture.md) | System design, scheduling pipeline, data model, decisions |
| [Backend](docs/backend.md) | API, scoring, decomposition, scheduler, chat providers |
| [Frontend](docs/frontend.md) | Pages, components, design system, UI guidelines |
| [Machine learning](docs/ml.md) | Status and roadmap |
