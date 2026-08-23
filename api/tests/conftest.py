from __future__ import annotations

import os

os.environ["SIGNAL_GARDEN_DATABASE_URL"] = "sqlite:///./test_signal_garden.db"
os.environ["SIGNAL_GARDEN_AI_PROVIDER"] = "deterministic"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture(autouse=True)
def clean_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def workspace_id(client: TestClient) -> str:
    response = client.post("/api/workspaces", json={"name": "Test research", "description": "API integration test"})
    assert response.status_code == 201
    return response.json()["id"]


@pytest.fixture
def three_documents():
    return [
        {"name": "interview-a.md", "source_type": "interview", "participant": "A", "channel": "Zoom", "created_date": "2026-08-20T10:00:00Z", "detected_encoding": "utf-8", "content": "I trust this only when the source and exact evidence are visible."},
        {"name": "interview-b.txt", "source_type": "interview", "participant": "B", "channel": "Meet", "created_date": "2026-08-21T10:00:00Z", "detected_encoding": "utf-8", "content": "The workflow is slow and I lose time rebuilding context across tabs."},
        {"name": "interview-c.json", "source_type": "interview", "participant": "C", "channel": "In person", "created_date": "2026-08-22T10:00:00Z", "detected_encoding": "utf-8", "content": "[{\"text\": \"I need the evidence grouped around the decision I have to make.\"}]"},
    ]
