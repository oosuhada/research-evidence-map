from __future__ import annotations

from fastapi.testclient import TestClient


def analyzed(client: TestClient, workspace_id: str, documents):
    detail = client.post(f"/api/workspaces/{workspace_id}/sources", json={"documents": documents, "confirmed_sensitive_data": False}).json()
    client.post(f"/api/workspaces/{workspace_id}/analysis", json={"source_document_ids": [item["id"] for item in detail["sources"]]})
    return client.get(f"/api/workspaces/{workspace_id}").json()


def test_evidence_edit_move_merge_split_and_undo_redo(client: TestClient, workspace_id: str, three_documents):
    detail = analyzed(client, workspace_id, three_documents)
    evidence = detail["evidence"]
    clusters = [item for item in detail["clusters"] if item["review_state"] != "superseded"]
    first = evidence[0]
    target_cluster = clusters[-1]
    patched = client.patch(f"/api/evidence/{first['id']}", json={"body": first["body"] + " Reviewed by researcher.", "review_state": "accepted", "cluster_id": target_cluster["id"]})
    assert patched.status_code == 200
    assert patched.json()["review_state"] == "edited"
    assert patched.json()["version"] == 2

    detail = client.get(f"/api/workspaces/{workspace_id}").json()
    clusters = [item for item in detail["clusters"] if item["review_state"] != "superseded"]
    assert len(clusters) >= 2
    merged = client.post(f"/api/workspaces/{workspace_id}/clusters/merge", json={"cluster_ids": [clusters[0]["id"], clusters[1]["id"]], "label": "Merged evidence"})
    assert merged.status_code == 201
    merged_id = merged.json()["id"]
    assert any(item["id"] == merged_id for item in client.get(f"/api/workspaces/{workspace_id}").json()["clusters"])

    undo = client.post(f"/api/workspaces/{workspace_id}/history/undo")
    assert undo.status_code == 200 and undo.json()["undone"] is True
    after_undo = client.get(f"/api/workspaces/{workspace_id}").json()
    assert not any(item["id"] == merged_id for item in after_undo["clusters"])
    redo = client.post(f"/api/workspaces/{workspace_id}/history/redo")
    assert redo.status_code == 200 and redo.json()["undone"] is False
    after_redo = client.get(f"/api/workspaces/{workspace_id}").json()
    merged_cluster = next(item for item in after_redo["clusters"] if item["id"] == merged_id)

    members = merged_cluster["evidence_item_ids"]
    if len(members) >= 2:
        split = client.post(f"/api/workspaces/{workspace_id}/clusters/{merged_id}/split", json={"groups": [{"label": "Split A", "evidence_item_ids": [members[0]]}, {"label": "Split B", "evidence_item_ids": members[1:]}]})
        assert split.status_code == 201
        refreshed = client.get(f"/api/workspaces/{workspace_id}").json()
        labels = {item["label"] for item in refreshed["clusters"] if item["review_state"] != "superseded"}
        assert {"Split A", "Split B"}.issubset(labels)


def test_new_cluster_requires_actual_evidence_selection(client: TestClient, workspace_id: str, three_documents):
    detail = analyzed(client, workspace_id, three_documents)
    ids = [item["id"] for item in detail["evidence"][:2]]
    response = client.post(f"/api/workspaces/{workspace_id}/clusters", json={"label": "Human theme", "evidence_item_ids": ids})
    assert response.status_code == 201
    refreshed = client.get(f"/api/workspaces/{workspace_id}").json()
    cluster = next(item for item in refreshed["clusters"] if item["id"] == response.json()["id"])
    assert set(cluster["evidence_item_ids"]) == set(ids)
    assert cluster["review_state"] == "edited"
