from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from . import models
from .ai import get_adapter
from .importers import fragment_text
from .repository import record_edit, require_workspace


def run_analysis(db: Session, workspace_id: str, source_document_ids: list[str] | None = None) -> models.AnalysisRun:
    require_workspace(db, workspace_id)
    adapter = get_adapter()
    run = models.AnalysisRun(
        workspace_id=workspace_id,
        provider=adapter.metadata.provider,
        model=adapter.metadata.model,
        prompt_version=adapter.metadata.prompt_version,
        schema_version=adapter.metadata.schema_version,
    )
    db.add(run)
    db.flush()
    query = select(models.SourceDocument).where(models.SourceDocument.workspace_id == workspace_id)
    if source_document_ids:
        query = query.where(models.SourceDocument.id.in_(source_document_ids))
    sources = db.scalars(query).all()
    if not sources:
        run.status = "failed"
        run.failure_reason = "No sources selected for analysis"
        run.completed_at = datetime.now(timezone.utc)
        db.commit()
        return run
    source_ids = [source.id for source in sources]
    fragments = db.scalars(
        select(models.SourceFragment)
        .where(models.SourceFragment.source_document_id.in_(source_ids))
        .order_by(models.SourceFragment.source_document_id, models.SourceFragment.ordinal)
    ).all()
    cluster_by_label: dict[str, models.Cluster] = {}
    created_evidence: list[models.EvidenceItem] = []
    try:
        for fragment in fragments:
            if run.status == "cancelled":
                break
            payload = adapter.extract(fragment.text)
            for extracted in payload.evidence:
                evidence = models.EvidenceItem(
                    workspace_id=workspace_id,
                    analysis_run_id=run.id,
                    title=extracted.title,
                    body=extracted.body,
                    kind=extracted.kind,
                    source_fragment_ids=[fragment.id],
                    extraction_status="extracted",
                    review_state="proposed",
                    provider=adapter.metadata.provider,
                    model=adapter.metadata.model,
                    prompt_version=adapter.metadata.prompt_version,
                    schema_version=adapter.metadata.schema_version,
                )
                db.add(evidence)
                db.flush()
                created_evidence.append(evidence)
                cluster = cluster_by_label.get(extracted.cluster)
                if cluster is None:
                    cluster = models.Cluster(
                        workspace_id=workspace_id,
                        analysis_run_id=run.id,
                        label=extracted.cluster,
                        provider=adapter.metadata.provider,
                        model=adapter.metadata.model,
                        prompt_version="cluster-v1",
                        schema_version="cluster-v1",
                    )
                    db.add(cluster)
                    db.flush()
                    cluster_by_label[extracted.cluster] = cluster
                db.add(models.ClusterMembership(cluster_id=cluster.id, evidence_item_id=evidence.id))
        if run.status != "cancelled":
            run.status = "succeeded"
        run.token_input = sum(max(1, len(fragment.text) // 4) for fragment in fragments)
        run.token_output = sum(max(1, len(item.body) // 5) for item in created_evidence)
        run.cost_usd = 0.0 if adapter.metadata.provider == "deterministic" else round((run.token_input + run.token_output) / 1_000_000, 6)
    except Exception as exc:  # provider/schema failures are persisted, not swallowed
        run.status = "failed"
        run.failure_reason = str(exc)[:2000]
    run.completed_at = datetime.now(timezone.utc)
    db.commit()
    return run


def cancel_analysis(db: Session, workspace_id: str, run_id: str) -> models.AnalysisRun:
    run = db.get(models.AnalysisRun, run_id)
    if run is None or run.workspace_id != workspace_id:
        raise KeyError("analysis run not found")
    if run.status in {"running", "queued"}:
        run.status = "cancelled"
        run.cancelled_at = datetime.now(timezone.utc)
        run.completed_at = run.cancelled_at
        db.commit()
    return run


def patch_evidence(db: Session, evidence_id: str, payload: dict) -> models.EvidenceItem:
    evidence = db.get(models.EvidenceItem, evidence_id)
    if evidence is None:
        raise KeyError("evidence not found")
    current_membership = db.scalar(select(models.ClusterMembership).where(models.ClusterMembership.evidence_item_id == evidence.id))
    before = {"title": evidence.title, "body": evidence.body, "review_state": evidence.review_state, "excluded": evidence.excluded, "cluster_id": current_membership.cluster_id if current_membership else None}
    cluster_id = payload.pop("cluster_id", None)
    for key, value in payload.items():
        if value is not None:
            setattr(evidence, key, value)
    if any(key in payload for key in ("title", "body")):
        evidence.review_state = "edited"
        evidence.version += 1
    if cluster_id:
        db.execute(delete(models.ClusterMembership).where(models.ClusterMembership.evidence_item_id == evidence.id))
        db.add(models.ClusterMembership(cluster_id=cluster_id, evidence_item_id=evidence.id))
    after = {"title": evidence.title, "body": evidence.body, "review_state": evidence.review_state, "excluded": evidence.excluded, "cluster_id": cluster_id}
    record_edit(db, evidence.workspace_id, "evidence", evidence.id, "edit", before, after)
    db.commit()
    return evidence


def create_cluster(db: Session, workspace_id: str, label: str, evidence_ids: list[str]) -> models.Cluster:
    require_workspace(db, workspace_id)
    previous_memberships = db.scalars(select(models.ClusterMembership).where(models.ClusterMembership.evidence_item_id.in_(evidence_ids))).all() if evidence_ids else []
    previous_by_evidence = {item.evidence_item_id: item.cluster_id for item in previous_memberships}
    cluster = models.Cluster(workspace_id=workspace_id, label=label, review_state="edited")
    db.add(cluster)
    db.flush()
    for evidence_id in evidence_ids:
        db.execute(delete(models.ClusterMembership).where(models.ClusterMembership.evidence_item_id == evidence_id))
        db.add(models.ClusterMembership(cluster_id=cluster.id, evidence_item_id=evidence_id))
    record_edit(db, workspace_id, "cluster", cluster.id, "create", {"memberships": previous_by_evidence}, {"id": cluster.id, "label": label, "evidence_item_ids": evidence_ids})
    db.commit()
    return cluster


def merge_clusters(db: Session, workspace_id: str, cluster_ids: list[str], label: str) -> models.Cluster:
    clusters = db.scalars(select(models.Cluster).where(models.Cluster.workspace_id == workspace_id, models.Cluster.id.in_(cluster_ids))).all()
    if len(clusters) != len(set(cluster_ids)):
        raise KeyError("one or more clusters not found")
    memberships = db.scalars(select(models.ClusterMembership).where(models.ClusterMembership.cluster_id.in_(cluster_ids))).all()
    evidence_ids = list(dict.fromkeys(item.evidence_item_id for item in memberships))
    merged = models.Cluster(workspace_id=workspace_id, label=label, review_state="edited", version=max((item.version for item in clusters), default=0) + 1)
    db.add(merged)
    db.flush()
    for evidence_id in evidence_ids:
        db.add(models.ClusterMembership(cluster_id=merged.id, evidence_item_id=evidence_id))
    for cluster in clusters:
        cluster.review_state = "superseded"
        cluster.superseded_by_id = merged.id
    record_edit(db, workspace_id, "cluster", merged.id, "merge", {"cluster_ids": cluster_ids}, {"id": merged.id, "label": label, "evidence_item_ids": evidence_ids})
    db.commit()
    return merged


def split_cluster(db: Session, workspace_id: str, cluster_id: str, groups: list[dict]) -> list[models.Cluster]:
    cluster = db.get(models.Cluster, cluster_id)
    if cluster is None or cluster.workspace_id != workspace_id:
        raise KeyError("cluster not found")
    existing = set(db.scalars(select(models.ClusterMembership.evidence_item_id).where(models.ClusterMembership.cluster_id == cluster_id)).all())
    requested = [item for group in groups for item in group["evidence_item_ids"]]
    if not requested or not set(requested).issubset(existing):
        raise ValueError("split groups must contain evidence from the source cluster")
    created: list[models.Cluster] = []
    for group in groups:
        new_cluster = models.Cluster(workspace_id=workspace_id, label=group["label"], review_state="edited", version=cluster.version + 1)
        db.add(new_cluster)
        db.flush()
        created.append(new_cluster)
        for evidence_id in group["evidence_item_ids"]:
            db.add(models.ClusterMembership(cluster_id=new_cluster.id, evidence_item_id=evidence_id))
    cluster.review_state = "superseded"
    cluster.superseded_by_id = created[0].id
    record_edit(db, workspace_id, "cluster", cluster.id, "split", {"id": cluster.id, "label": cluster.label}, {"groups": [{**group, "id": created[index].id} for index, group in enumerate(groups)]})
    db.commit()
    return created


def _set_evidence_snapshot(db: Session, evidence_id: str, snapshot: dict) -> None:
    evidence = db.get(models.EvidenceItem, evidence_id)
    if evidence is None:
        return
    for key in ("title", "body", "review_state", "excluded"):
        if key in snapshot:
            setattr(evidence, key, snapshot[key])
    db.execute(delete(models.ClusterMembership).where(models.ClusterMembership.evidence_item_id == evidence_id))
    if snapshot.get("cluster_id"):
        db.add(models.ClusterMembership(cluster_id=snapshot["cluster_id"], evidence_item_id=evidence_id))


def _undo_edit(db: Session, edit: models.HumanEdit) -> None:
    if edit.entity_type == "evidence" and edit.action == "edit":
        _set_evidence_snapshot(db, edit.entity_id, edit.before_json)
        return
    if edit.entity_type == "cluster" and edit.action == "create":
        cluster = db.get(models.Cluster, edit.entity_id)
        if cluster:
            db.execute(delete(models.ClusterMembership).where(models.ClusterMembership.cluster_id == cluster.id))
            db.delete(cluster)
            db.flush()
        for evidence_id, cluster_id in edit.before_json.get("memberships", {}).items():
            db.execute(delete(models.ClusterMembership).where(models.ClusterMembership.evidence_item_id == evidence_id))
            if cluster_id:
                db.add(models.ClusterMembership(cluster_id=cluster_id, evidence_item_id=evidence_id))
        return
    if edit.entity_type == "cluster" and edit.action == "merge":
        merged = db.get(models.Cluster, edit.after_json.get("id"))
        if merged:
            db.execute(delete(models.ClusterMembership).where(models.ClusterMembership.cluster_id == merged.id))
            db.delete(merged)
            db.flush()
        for cluster_id in edit.before_json.get("cluster_ids", []):
            cluster = db.get(models.Cluster, cluster_id)
            if cluster:
                cluster.review_state = "edited"
                cluster.superseded_by_id = None
        return
    if edit.entity_type == "cluster" and edit.action == "split":
        for group in edit.after_json.get("groups", []):
            created = db.get(models.Cluster, group.get("id"))
            if created:
                db.execute(delete(models.ClusterMembership).where(models.ClusterMembership.cluster_id == created.id))
                db.delete(created)
        original = db.get(models.Cluster, edit.before_json.get("id"))
        if original:
            original.review_state = "edited"
            original.superseded_by_id = None
        return
    if edit.action == "create" and edit.entity_type in {"opportunity", "contradiction", "decision"}:
        model = {
            "opportunity": models.Opportunity,
            "contradiction": models.Contradiction,
            "decision": models.DecisionRecord,
        }[edit.entity_type]
        entity = db.get(model, edit.entity_id)
        if entity:
            db.delete(entity)


def _redo_edit(db: Session, edit: models.HumanEdit) -> None:
    if edit.entity_type == "evidence" and edit.action == "edit":
        _set_evidence_snapshot(db, edit.entity_id, edit.after_json)
        return
    if edit.entity_type == "cluster" and edit.action == "create":
        payload = edit.after_json
        cluster = models.Cluster(id=payload["id"], workspace_id=edit.workspace_id, label=payload["label"], review_state="edited")
        db.add(cluster)
        db.flush()
        for evidence_id in payload.get("evidence_item_ids", []):
            db.execute(delete(models.ClusterMembership).where(models.ClusterMembership.evidence_item_id == evidence_id))
            db.add(models.ClusterMembership(cluster_id=cluster.id, evidence_item_id=evidence_id))
        return
    if edit.entity_type == "cluster" and edit.action == "merge":
        payload = edit.after_json
        merged = models.Cluster(id=payload["id"], workspace_id=edit.workspace_id, label=payload["label"], review_state="edited")
        db.add(merged)
        db.flush()
        for evidence_id in payload.get("evidence_item_ids", []):
            db.add(models.ClusterMembership(cluster_id=merged.id, evidence_item_id=evidence_id))
        for cluster_id in edit.before_json.get("cluster_ids", []):
            cluster = db.get(models.Cluster, cluster_id)
            if cluster:
                cluster.review_state = "superseded"
                cluster.superseded_by_id = merged.id
        return
    if edit.entity_type == "cluster" and edit.action == "split":
        original = db.get(models.Cluster, edit.before_json.get("id"))
        first_id = None
        for group in edit.after_json.get("groups", []):
            cluster = models.Cluster(id=group["id"], workspace_id=edit.workspace_id, label=group["label"], review_state="edited")
            db.add(cluster)
            db.flush()
            first_id = first_id or cluster.id
            for evidence_id in group.get("evidence_item_ids", []):
                db.add(models.ClusterMembership(cluster_id=cluster.id, evidence_item_id=evidence_id))
        if original:
            original.review_state = "superseded"
            original.superseded_by_id = first_id
        return
    if edit.entity_type == "opportunity" and edit.action == "create":
        payload = edit.after_json
        db.add(models.Opportunity(id=edit.entity_id, workspace_id=edit.workspace_id, review_state="edited", **payload))
        return
    if edit.entity_type == "contradiction" and edit.action == "create":
        payload = edit.after_json
        db.add(models.Contradiction(id=edit.entity_id, workspace_id=edit.workspace_id, **payload))
        return
    if edit.entity_type == "decision" and edit.action == "create":
        payload = edit.after_json
        db.add(models.DecisionRecord(id=edit.entity_id, workspace_id=edit.workspace_id, **payload))


def undo_last(db: Session, workspace_id: str) -> models.HumanEdit:
    edit = db.scalar(
        select(models.HumanEdit)
        .where(models.HumanEdit.workspace_id == workspace_id, models.HumanEdit.undone.is_(False))
        .order_by(models.HumanEdit.created_at.desc())
        .limit(1)
    )
    if edit is None:
        raise ValueError("Nothing to undo")
    _undo_edit(db, edit)
    edit.undone = True
    db.commit()
    return edit


def redo_last(db: Session, workspace_id: str) -> models.HumanEdit:
    edit = db.scalar(
        select(models.HumanEdit)
        .where(models.HumanEdit.workspace_id == workspace_id, models.HumanEdit.undone.is_(True))
        .order_by(models.HumanEdit.created_at.asc())
        .limit(1)
    )
    if edit is None:
        raise ValueError("Nothing to redo")
    _redo_edit(db, edit)
    edit.undone = False
    db.commit()
    return edit


def challenge_opportunity(db: Session, workspace_id: str, opportunity_id: str) -> models.ChallengeRun:
    opportunity = db.get(models.Opportunity, opportunity_id)
    if opportunity is None or opportunity.workspace_id != workspace_id:
        raise KeyError("opportunity not found")
    evidence = db.scalars(select(models.EvidenceItem).where(models.EvidenceItem.id.in_(opportunity.evidence_item_ids))).all()
    fragment_ids = list(dict.fromkeys(fragment_id for item in evidence for fragment_id in item.source_fragment_ids))
    adapter = get_adapter()
    try:
        response = adapter.challenge(opportunity.title, [item.body for item in evidence])
        failure_reason = None
        status = "extracted"
    except Exception as exc:
        response = ""
        failure_reason = str(exc)[:2000]
        status = "failed"
    run = models.ChallengeRun(
        workspace_id=workspace_id,
        opportunity_id=opportunity.id,
        response=response,
        provider=adapter.metadata.provider,
        model=adapter.metadata.model,
        source_fragment_ids=fragment_ids,
        extraction_status=status,
        failure_reason=failure_reason,
        token_input=sum(max(1, len(item.body) // 4) for item in evidence),
        token_output=max(0, len(response) // 4),
        cost_usd=0.0,
    )
    db.add(run)
    db.commit()
    return run
