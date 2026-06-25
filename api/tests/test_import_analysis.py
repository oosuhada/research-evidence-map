from __future__ import annotations

from fastapi.testclient import TestClient

from app import models
from app.ai import AdapterMetadata
from app.database import SessionLocal
from app.schemas import AnalysisRequest
import app.service as service


def test_import_preview_fragmentation_duplicate_and_no_auto_analysis(client: TestClient, workspace_id: str, three_documents):
    preview = client.post(f"/api/workspaces/{workspace_id}/sources/preview", json={"documents": three_documents})
    assert preview.status_code == 200
    payload = preview.json()
    assert payload["analysis_started"] is False
    assert [item["fragment_count"] for item in payload["documents"]] == [1, 1, 1]
    assert not any(item["duplicate"] for item in payload["documents"])

    imported = client.post(f"/api/workspaces/{workspace_id}/sources", json={"documents": three_documents, "confirmed_sensitive_data": False})
    assert imported.status_code == 201
    detail = imported.json()
    assert len(detail["sources"]) == 3
    assert len(detail["fragments"]) == 3
    assert detail["analysis_runs"] == []
    assert detail["fragments"][0]["locator"].startswith("¶1")

    duplicate = client.post(f"/api/workspaces/{workspace_id}/sources/preview", json={"documents": [three_documents[0]]}).json()
    assert duplicate["documents"][0]["duplicate"] is True


def test_sensitive_warning_requires_acknowledgement(client: TestClient, workspace_id: str):
    docs = [{"name": "customer.txt", "source_type": "support", "participant": None, "channel": "email", "created_date": None, "detected_encoding": "utf-8", "content": "Contact test@example.com because the support workflow failed."}]
    preview = client.post(f"/api/workspaces/{workspace_id}/sources/preview", json={"documents": docs}).json()
    assert preview["documents"][0]["sensitive_warning"] is True
    blocked = client.post(f"/api/workspaces/{workspace_id}/sources", json={"documents": docs, "confirmed_sensitive_data": False})
    assert blocked.status_code == 409
    accepted = client.post(f"/api/workspaces/{workspace_id}/sources", json={"documents": docs, "confirmed_sensitive_data": True})
    assert accepted.status_code == 201


def test_analysis_success_provenance_and_provider_failure(client: TestClient, workspace_id: str, three_documents, monkeypatch):
    detail = client.post(f"/api/workspaces/{workspace_id}/sources", json={"documents": three_documents, "confirmed_sensitive_data": False}).json()
    run = client.post(f"/api/workspaces/{workspace_id}/analysis", json={"source_document_ids": [item["id"] for item in detail["sources"]]})
    assert run.status_code == 201
    assert run.json()["status"] == "succeeded"
    refreshed = client.get(f"/api/workspaces/{workspace_id}").json()
    assert len(refreshed["evidence"]) == 3
    for evidence in refreshed["evidence"]:
        assert evidence["source_fragment_ids"]
        assert evidence["provider"] == "deterministic"
        assert evidence["prompt_version"] == "extract-v1"
        assert evidence["schema_version"] == "evidence-v1"
        assert evidence["extraction_status"] == "extracted"
        assert evidence["review_state"] == "proposed"

    class BrokenAdapter:
        metadata = AdapterMetadata(provider="broken", model="broken-v1")
        def extract(self, text: str): raise RuntimeError("malformed output")
        def challenge(self, opportunity: str, evidence: list[str]): raise RuntimeError("malformed output")

    monkeypatch.setattr(service, "get_adapter", lambda: BrokenAdapter())
    with SessionLocal() as db:
        failed = service.run_analysis(db, workspace_id)
        assert failed.status == "failed"
        assert "malformed output" in (failed.failure_reason or "")


def test_analysis_cancel_state_is_persisted(client: TestClient, workspace_id: str):
    with SessionLocal() as db:
        run = models.AnalysisRun(workspace_id=workspace_id, provider="deterministic", model="test", status="running")
        db.add(run); db.commit(); run_id = run.id
    response = client.post(f"/api/workspaces/{workspace_id}/analysis/{run_id}/cancel")
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    detail = client.get(f"/api/workspaces/{workspace_id}").json()
    assert next(item for item in detail["analysis_runs"] if item["id"] == run_id)["cancelled_at"] is not None
