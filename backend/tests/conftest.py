"""Point every test at a throwaway SQLite file, never the dev database."""
import os
import tempfile

_TMP_DB = os.path.join(tempfile.mkdtemp(prefix="task-scheduler-tests-"), "test.db")
os.environ["TASK_SCHEDULER_DB"] = _TMP_DB
# The echo provider paces itself for the UI; tests should not wait for it.
os.environ["CHAT_ECHO_DELAY"] = "0"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture()
def client():
    from app.db import Base, engine
    from app.main import app
    from app.seed import bootstrap

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    bootstrap()
    with TestClient(app) as test_client:
        yield test_client
