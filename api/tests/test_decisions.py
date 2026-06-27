from __future__ import annotations

from fastapi.testclient import TestClient


def test_human_decision_snapshots_verification_context_and_versions(
    client: TestClient,
    workspace_id: str,
    three_documents,
):
    imported = client.post(
        f"/api/workspaces/{workspace_id}/sources",
        json={"documents": three_documents, "confirmed_sensitive_data": False},
    )
    assert imported.status_code == 201

    source_ids = [item["id"] for item in imported.json()["sources"]]
    analysis = client.post(
        f"/api/workspaces/{workspace_id}/analysis",
        json={"source_document_ids": source_ids},
    )
    assert analysis.status_code == 201

    detail = client.get(f"/api/workspaces/{workspace_id}").json()
    evidence = detail["evidence"][:2]
    assert len(evidence) == 2

    for item in evidence:
        reviewed = client.patch(
            f"/api/evidence/{item['id']}",
            json={"review_state": "accepted"},
        )
        assert reviewed.status_code == 200

    opportunity = client.post(
        f"/api/workspaces/{workspace_id}/opportunities",
        json={
            "title": "Decision verification gate",
            "body": "Preserve evidence and uncertainty at the moment a product decision is made.",
            "evidence_item_ids": [item["id"] for item in evidence],
        },
    )
    assert opportunity.status_code == 201
    opportunity_id = opportunity.json()["id"]

    challenge = client.post(
        f"/api/workspaces/{workspace_id}/opportunities/{opportunity_id}/challenge"
    )
    assert challenge.status_code == 201

    contradiction = client.post(
        f"/api/workspaces/{workspace_id}/contradictions",
        json={
            "opportunity_id": opportunity_id,
            "evidence_item_ids": [evidence[-1]["id"]],
            "note": "A smaller workflow may value speed over always-visible verification detail.",
        },
    )
    assert contradiction.status_code == 201

    first = client.post(
        f"/api/workspaces/{workspace_id}/opportunities/{opportunity_id}/decisions",
        json={
            "outcome": "experiment",
            "rationale": "Run a focused prototype test before committing because the evidence is reviewed but contains a contradiction.",
            "next_step": "Test the verification gate with five product practitioners.",
        },
    )
    assert first.status_code == 201
    first_payload = first.json()
    assert first_payload["version"] == 1
    assert first_payload["supersedes_decision_id"] is None
    assert first_payload["evidence_item_ids"] == [item["id"] for item in evidence]
    assert first_payload["reviewed_evidence_count"] == 2
    assert first_payload["unresolved_evidence_count"] == 0
    assert first_payload["source_fragment_ids"]
    assert first_payload["challenge_run_ids"] == [challenge.json()["id"]]
    assert first_payload["contradiction_ids"] == [contradiction.json()["id"]]

    second = client.post(
        f"/api/workspaces/{workspace_id}/opportunities/{opportunity_id}/decisions",
        json={
            "outcome": "proceed",
            "rationale": "Proceed to a broader prototype test after explicitly recording the remaining uncertainty.",
            "next_step": "Recruit the next validation cohort.",
        },
    )
    assert second.status_code == 201
    second_payload = second.json()
    assert second_payload["version"] == 2
    assert second_payload["supersedes_decision_id"] == first_payload["id"]

    refreshed = client.get(f"/api/workspaces/{workspace_id}").json()
    assert [item["version"] for item in refreshed["decisions"]] == [1, 2]

    report = client.get(f"/api/workspaces/{workspace_id}/exports/report.md")
    assert report.status_code == 200
    assert "## Human Decisions" in report.text
    assert "Run a focused prototype test" in report.text
    assert "Proceed to a broader prototype test" in report.text

    undo = client.post(f"/api/workspaces/{workspace_id}/history/undo")
    assert undo.status_code == 200
    assert undo.json()["entity_type"] == "decision"
    after_undo = client.get(f"/api/workspaces/{workspace_id}").json()
    assert [item["version"] for item in after_undo["decisions"]] == [1]

    redo = client.post(f"/api/workspaces/{workspace_id}/history/redo")
    assert redo.status_code == 200
    after_redo = client.get(f"/api/workspaces/{workspace_id}").json()
    assert [item["version"] for item in after_redo["decisions"]] == [1, 2]
