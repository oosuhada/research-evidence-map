from __future__ import annotations

from fastapi.testclient import TestClient


def prepare(client: TestClient, workspace_id: str, documents):
    detail = client.post(f"/api/workspaces/{workspace_id}/sources", json={"documents": documents, "confirmed_sensitive_data": False}).json()
    client.post(f"/api/workspaces/{workspace_id}/analysis", json={"source_document_ids": [item["id"] for item in detail["sources"]]})
    return client.get(f"/api/workspaces/{workspace_id}").json()


def test_opportunity_challenge_source_trace_export_refresh_and_share_revoke(client: TestClient, workspace_id: str, three_documents):
    detail = prepare(client, workspace_id, three_documents)
    evidence_ids = [item["id"] for item in detail["evidence"][:2]]
    opportunity = client.post(f"/api/workspaces/{workspace_id}/opportunities", json={"title": "Evidence on demand", "body": "Reveal exact evidence only when a decision is challenged.", "evidence_item_ids": evidence_ids})
    assert opportunity.status_code == 201
    opportunity_id = opportunity.json()["id"]
    challenge = client.post(f"/api/workspaces/{workspace_id}/opportunities/{opportunity_id}/challenge")
    assert challenge.status_code == 201
    assert challenge.json()["response"]
    assert challenge.json()["source_fragment_ids"]

    contradiction = client.post(f"/api/workspaces/{workspace_id}/contradictions", json={"note": "Some routine users may prefer less citation density.", "evidence_item_ids": [detail["evidence"][-1]["id"]], "opportunity_id": opportunity_id})
    assert contradiction.status_code == 201

    csv_export = client.get(f"/api/workspaces/{workspace_id}/exports/evidence.csv")
    assert csv_export.status_code == 200
    assert "source_locator" in csv_export.text and "provider" in csv_export.text
    report = client.get(f"/api/workspaces/{workspace_id}/exports/report.md")
    assert report.status_code == 200
    assert "Evidence on demand" in report.text and "Source:" in report.text

    share = client.post(f"/api/workspaces/{workspace_id}/shares", json={"filter_json": {"view": "map", "opportunity": opportunity_id}})
    token = share.json()["token"]
    assert client.get(f"/api/shares/{token}").status_code == 200
    assert client.delete(f"/api/workspaces/{workspace_id}/shares/{share.json()['id']}").status_code == 204
    assert client.get(f"/api/shares/{token}").status_code == 404

    refreshed = client.get(f"/api/workspaces/{workspace_id}").json()
    assert any(item["id"] == opportunity_id for item in refreshed["opportunities"])
    assert any(item["opportunity_id"] == opportunity_id for item in refreshed["challenges"])
    fragment_ids = {fragment["id"] for fragment in refreshed["fragments"]}
    assert set(refreshed["evidence"][0]["source_fragment_ids"]).issubset(fragment_ids)


def test_workspace_and_source_deletion(client: TestClient, workspace_id: str, three_documents):
    detail = client.post(f"/api/workspaces/{workspace_id}/sources", json={"documents": three_documents, "confirmed_sensitive_data": False}).json()
    source_id = detail["sources"][0]["id"]
    assert client.delete(f"/api/workspaces/{workspace_id}/sources/{source_id}").status_code == 204
    assert len(client.get(f"/api/workspaces/{workspace_id}").json()["sources"]) == 2
    assert client.delete(f"/api/workspaces/{workspace_id}").status_code == 204
    assert client.get(f"/api/workspaces/{workspace_id}").status_code == 404
