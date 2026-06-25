from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .config import settings


def require_workspace(db: Session, workspace_id: str) -> models.Workspace:
    workspace = db.get(models.Workspace, workspace_id)
    if workspace is None or workspace.deleted_at is not None:
        raise KeyError("workspace not found")
    return workspace


def workspace_detail(db: Session, workspace_id: str) -> dict:
    workspace = require_workspace(db, workspace_id)
    sources = db.scalars(select(models.SourceDocument).where(models.SourceDocument.workspace_id == workspace_id).order_by(models.SourceDocument.created_at)).all()
    source_ids = [item.id for item in sources]
    fragments = db.scalars(select(models.SourceFragment).where(models.SourceFragment.source_document_id.in_(source_ids)).order_by(models.SourceFragment.source_document_id, models.SourceFragment.ordinal)).all() if source_ids else []
    runs = db.scalars(select(models.AnalysisRun).where(models.AnalysisRun.workspace_id == workspace_id).order_by(models.AnalysisRun.started_at.desc())).all()
    evidence = db.scalars(select(models.EvidenceItem).where(models.EvidenceItem.workspace_id == workspace_id).order_by(models.EvidenceItem.created_at)).all()
    clusters = db.scalars(select(models.Cluster).where(models.Cluster.workspace_id == workspace_id).order_by(models.Cluster.created_at)).all()
    cluster_ids = [cluster.id for cluster in clusters]
    memberships = db.scalars(select(models.ClusterMembership).where(models.ClusterMembership.cluster_id.in_(cluster_ids))).all() if cluster_ids else []
    members_by_cluster: dict[str, list[str]] = {}
    for membership in memberships:
        members_by_cluster.setdefault(membership.cluster_id, []).append(membership.evidence_item_id)
    opportunities = db.scalars(select(models.Opportunity).where(models.Opportunity.workspace_id == workspace_id).order_by(models.Opportunity.created_at)).all()
    contradictions = db.scalars(select(models.Contradiction).where(models.Contradiction.workspace_id == workspace_id).order_by(models.Contradiction.created_at)).all()
    challenges = db.scalars(select(models.ChallengeRun).where(models.ChallengeRun.workspace_id == workspace_id).order_by(models.ChallengeRun.created_at)).all()
    human_edits = db.scalars(select(models.HumanEdit).where(models.HumanEdit.workspace_id == workspace_id).order_by(models.HumanEdit.created_at.desc()).limit(100)).all()
    shares = db.scalars(select(models.ShareLink).where(models.ShareLink.workspace_id == workspace_id).order_by(models.ShareLink.created_at.desc())).all()
    return {
        "workspace": workspace,
        "sources": sources,
        "fragments": fragments,
        "analysis_runs": runs,
        "evidence": evidence,
        "clusters": [{
            "id": item.id,
            "label": item.label,
            "review_state": item.review_state,
            "provider": item.provider,
            "model": item.model,
            "prompt_version": item.prompt_version,
            "schema_version": item.schema_version,
            "version": item.version,
            "superseded_by_id": item.superseded_by_id,
            "failure_reason": item.failure_reason,
            "evidence_item_ids": members_by_cluster.get(item.id, []),
        } for item in clusters],
        "opportunities": opportunities,
        "contradictions": contradictions,
        "challenges": challenges,
        "human_edits": human_edits,
        "shares": shares,
        "retention_days": settings.retention_days,
    }


def record_edit(db: Session, workspace_id: str, entity_type: str, entity_id: str, action: str, before: dict, after: dict) -> None:
    db.add(models.HumanEdit(
        workspace_id=workspace_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        before_json=before,
        after_json=after,
    ))
