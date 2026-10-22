from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

TEST_DB = Path(tempfile.gettempdir()) / "interpres_test.db"
os.environ["APP_ENV"] = "test"
os.environ["APP_SECRET"] = "test-secret"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["WEB_DIST_DIR"] = str(Path(tempfile.gettempdir()) / "interpres_no_dist")

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.routes import auth as auth_routes  # noqa: E402


@pytest.fixture(autouse=True)
def clean_database() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    auth_routes._limiter.clear()
    yield
    auth_routes._limiter.clear()


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client
