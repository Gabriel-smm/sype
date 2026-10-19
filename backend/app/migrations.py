"""In-place upgrades for an existing SQLite database.

No Alembic: `Base.metadata.create_all` adds new tables, `add_missing_columns`
adds new nullable columns to existing tables, and `run_data_migrations` applies
each named data migration once, recording it in `schema_migrations`.
"""
from collections.abc import Callable
from datetime import date

from sqlalchemy import MetaData, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateColumn

from . import models
from .calendar_defaults import (
    WeeklyBlock,
    ensure_default_categories,
    ensure_primary_calendar,
    events_from_weekly_blocks,
)
from .db import Base


def add_missing_columns(engine: Engine, metadata: MetaData | None = None) -> list[str]:
    """ALTER TABLE ... ADD COLUMN for each model column the database lacks.

    Returns the "table.column" names added. Tables that do not exist yet are
    skipped (create_all creates them whole). Refuses, before altering anything,
    a column SQLite cannot add to populated rows: NOT NULL without a
    server_default, or a primary-key / unique column.
    """
    metadata = metadata if metadata is not None else Base.metadata
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    pending = []
    for table in metadata.sorted_tables:
        if table.name not in existing_tables:
            continue
        present = {c["name"] for c in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in present:
                continue
            name = f"{table.name}.{column.name}"
            if column.primary_key or column.unique:
                raise RuntimeError(f"Cannot add primary-key or unique column {name} in place")
            if not column.nullable and column.server_default is None:
                raise RuntimeError(
                    f"Cannot add NOT NULL column {name} without a server_default"
                )
            pending.append((table, column, name))

    preparer = engine.dialect.identifier_preparer
    with engine.begin() as conn:
        for table, column, _ in pending:
            spec = CreateColumn(column).compile(dialect=engine.dialect)
            conn.execute(text(f"ALTER TABLE {preparer.format_table(table)} ADD COLUMN {spec}"))
    return [name for _, _, name in pending]


def migrate_fixed_blocks(db: Session) -> None:
    """Turn each student's weekly FixedBlock rows into recurring calendar events.

    Every student also gets the primary calendar and default categories. The
    FixedBlock rows are left as they are.
    """
    today = date.today()
    for student in db.query(models.Student).order_by(models.Student.id):
        ensure_primary_calendar(db, student.id)
        ensure_default_categories(db, student.id)
        blocks = (
            db.query(models.FixedBlock)
            .filter_by(student_id=student.id)
            .order_by(models.FixedBlock.id)
            .all()
        )
        events_from_weekly_blocks(db, student.id, [
            WeeklyBlock(b.kind, b.label or "", b.day_of_week, b.start_minute, b.end_minute)
            for b in blocks
        ], today=today)


DATA_MIGRATIONS: list[tuple[str, Callable[[Session], None]]] = [
    ("fixed_blocks_to_events", migrate_fixed_blocks),
]


def run_data_migrations(db: Session) -> list[str]:
    """Apply each not-yet-recorded data migration, committing it with its record."""
    done = {name for (name,) in db.query(models.SchemaMigration.name)}
    applied = []
    for name, migrate in DATA_MIGRATIONS:
        if name in done:
            continue
        try:
            migrate(db)
            db.add(models.SchemaMigration(name=name))
            db.commit()
        except Exception:
            db.rollback()
            raise
        applied.append(name)
    return applied
