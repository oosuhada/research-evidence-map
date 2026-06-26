from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models


STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on",
    "or", "that", "the", "this", "to", "with", "user", "users", "customer", "customers", "need", "needs",
}


def _theme_key(label: str) -> str:
    tokens = [token for token in re.findall(r"[a-z0-9]+", label.lower()) if token not in STOP_WORDS]
    return " ".join(sorted(dict.fromkeys(tokens))[:8]) or label.strip().lower()


def _contains(query: str, *values: str | None) -> bool:
    if not query:
        return True
    haystack = " ".join(value or "" for value in values).lower()
    return query in haystack


def build_research_memory(db: Session, query: str = "") -> dict:
    q = query.strip().lower()
    workspaces = list(db.scalars(
        select(models.Workspace)
        .where(models.Workspace.deleted_at.is_(None))
        .order_by(models.Workspace.updated_at.desc())
    ))
    workspace_by_id = {workspace.id: workspace for workspace in workspaces}
    workspace_ids = list(workspace_by_id)

    if not workspace_ids:
        return {
            "workspace_count": 0,
            "workspaces": [],
            "themes": [],
            "latest_comparison": None,
            "backlog": [],
            "opportunities": [],
            "search_results": [],
        }

    sources = list(db.scalars(select(models.SourceDocument).where(models.SourceDocument.workspace_id.in_(workspace_ids))))
    source_by_id = {source.id: source for source in sources}
    sources_by_workspace: dict[str, list[models.SourceDocument]] = defaultdict(list)
    for source in sources:
        sources_by_workspace[source.workspace_id].append(source)

    fragments = list(db.scalars(select(models.SourceFragment).where(models.SourceFragment.source_document_id.in_(list(source_by_id))))) if source_by_id else []
    fragment_by_id = {fragment.id: fragment for fragment in fragments}

    evidence = list(db.scalars(select(models.EvidenceItem).where(models.EvidenceItem.workspace_id.in_(workspace_ids))))
    evidence_by_id = {item.id: item for item in evidence}
    evidence_by_workspace: dict[str, list[models.EvidenceItem]] = defaultdict(list)
    for item in evidence:
        evidence_by_workspace[item.workspace_id].append(item)

    clusters = list(db.scalars(select(models.Cluster).where(models.Cluster.workspace_id.in_(workspace_ids))))
    active_clusters = [cluster for cluster in clusters if cluster.review_state != "superseded"]
    cluster_ids = [cluster.id for cluster in active_clusters]
    memberships = list(db.scalars(select(models.ClusterMembership).where(models.ClusterMembership.cluster_id.in_(cluster_ids)))) if cluster_ids else []
    members_by_cluster: dict[str, list[str]] = defaultdict(list)
    for membership in memberships:
        members_by_cluster[membership.cluster_id].append(membership.evidence_item_id)

    opportunities = list(db.scalars(select(models.Opportunity).where(models.Opportunity.workspace_id.in_(workspace_ids))))
    active_opportunities = [item for item in opportunities if item.review_state not in {"rejected", "superseded"}]
    contradictions = list(db.scalars(select(models.Contradiction).where(models.Contradiction.workspace_id.in_(workspace_ids))))

    contradiction_by_opportunity: dict[str, list[models.Contradiction]] = defaultdict(list)
    contradiction_by_workspace: dict[str, list[models.Contradiction]] = defaultdict(list)
    for item in contradictions:
        contradiction_by_workspace[item.workspace_id].append(item)
        if item.opportunity_id:
            contradiction_by_opportunity[item.opportunity_id].append(item)

    cluster_by_workspace: dict[str, list[models.Cluster]] = defaultdict(list)
    for cluster in active_clusters:
        cluster_by_workspace[cluster.workspace_id].append(cluster)

    opportunity_by_workspace: dict[str, list[models.Opportunity]] = defaultdict(list)
    for item in active_opportunities:
        opportunity_by_workspace[item.workspace_id].append(item)

    workspace_rows = []
    for workspace in workspaces:
        active_evidence = [item for item in evidence_by_workspace[workspace.id] if not item.excluded and item.review_state != "superseded"]
        reviewed_evidence = [item for item in active_evidence if item.review_state in {"reviewed", "accepted", "edited"}]
        workspace_rows.append({
            "id": workspace.id,
            "name": workspace.name,
            "description": workspace.description,
            "updated_at": workspace.updated_at,
            "source_count": len(sources_by_workspace[workspace.id]),
            "evidence_count": len(active_evidence),
            "reviewed_evidence_count": len(reviewed_evidence),
            "cluster_count": len(cluster_by_workspace[workspace.id]),
            "opportunity_count": len(opportunity_by_workspace[workspace.id]),
            "contradiction_count": len(contradiction_by_workspace[workspace.id]),
        })

    theme_groups: dict[str, dict] = {}
    for cluster in active_clusters:
        key = _theme_key(cluster.label)
        group = theme_groups.setdefault(key, {
            "key": key,
            "label": cluster.label,
            "workspace_ids": set(),
            "workspace_names": set(),
            "cluster_ids": [],
            "evidence_ids": set(),
            "first_seen": workspace_by_id[cluster.workspace_id].updated_at,
            "last_seen": workspace_by_id[cluster.workspace_id].updated_at,
        })
        workspace = workspace_by_id[cluster.workspace_id]
        group["workspace_ids"].add(workspace.id)
        group["workspace_names"].add(workspace.name)
        group["cluster_ids"].append(cluster.id)
        group["evidence_ids"].update(members_by_cluster[cluster.id])
        group["first_seen"] = min(group["first_seen"], workspace.updated_at)
        group["last_seen"] = max(group["last_seen"], workspace.updated_at)

    theme_rows = []
    for group in theme_groups.values():
        workspace_count = len(group["workspace_ids"])
        theme_rows.append({
            "key": group["key"],
            "label": group["label"],
            "workspace_ids": sorted(group["workspace_ids"]),
            "workspace_names": sorted(group["workspace_names"]),
            "cluster_ids": group["cluster_ids"],
            "workspace_count": workspace_count,
            "evidence_count": len(group["evidence_ids"]),
            "status": "recurring" if workspace_count > 1 else "single-workspace",
            "first_seen": group["first_seen"],
            "last_seen": group["last_seen"],
        })
    theme_rows.sort(key=lambda item: (item["workspace_count"], item["evidence_count"], item["last_seen"]), reverse=True)

    latest = workspaces[0]
    prior_theme_keys = {
        _theme_key(cluster.label)
        for cluster in active_clusters
        if cluster.workspace_id != latest.id
    }
    latest_clusters = cluster_by_workspace[latest.id]
    recurring_signals = [cluster.label for cluster in latest_clusters if _theme_key(cluster.label) in prior_theme_keys]
    new_signals = [cluster.label for cluster in latest_clusters if _theme_key(cluster.label) not in prior_theme_keys]
    latest_comparison = {
        "workspace_id": latest.id,
        "workspace_name": latest.name,
        "previous_workspace_count": max(0, len(workspaces) - 1),
        "recurring_signals": recurring_signals,
        "new_signals": new_signals,
    }

    backlog = []
    for workspace in workspaces:
        workspace_sources = sources_by_workspace[workspace.id]
        workspace_evidence = [item for item in evidence_by_workspace[workspace.id] if not item.excluded and item.review_state != "superseded"]
        if not workspace_sources or not workspace_evidence:
            reason = "No source material has been imported yet." if not workspace_sources else "Sources exist, but no evidence has been extracted yet."
            backlog.append({
                "id": f"question:{workspace.id}",
                "workspace_id": workspace.id,
                "workspace_name": workspace.name,
                "kind": "research-question",
                "label": workspace.description or workspace.name,
                "reason": reason,
                "updated_at": workspace.updated_at,
            })

        for cluster in cluster_by_workspace[workspace.id]:
            linked = [evidence_by_id[item_id] for item_id in members_by_cluster[cluster.id] if item_id in evidence_by_id and not evidence_by_id[item_id].excluded]
            source_ids = {
                fragment_by_id[fragment_id].source_document_id
                for item in linked
                for fragment_id in item.source_fragment_ids
                if fragment_id in fragment_by_id
            }
            if len(source_ids) < 2:
                backlog.append({
                    "id": f"cluster:{cluster.id}",
                    "workspace_id": workspace.id,
                    "workspace_name": workspace.name,
                    "kind": "evidence-gap",
                    "label": cluster.label,
                    "reason": "Theme is backed by fewer than two independent source documents.",
                    "updated_at": workspace.updated_at,
                })

        for contradiction in contradiction_by_workspace[workspace.id]:
            backlog.append({
                "id": f"contradiction:{contradiction.id}",
                "workspace_id": workspace.id,
                "workspace_name": workspace.name,
                "kind": "contradiction",
                "label": contradiction.note,
                "reason": "Explicit counter-evidence remains unresolved and should stay visible in the next research pass.",
                "updated_at": workspace.updated_at,
            })
    backlog.sort(key=lambda item: item["updated_at"], reverse=True)

    opportunity_rows = []
    for opportunity in active_opportunities:
        linked = [evidence_by_id[item_id] for item_id in opportunity.evidence_item_ids if item_id in evidence_by_id and not evidence_by_id[item_id].excluded]
        source_ids = {
            fragment_by_id[fragment_id].source_document_id
            for item in linked
            for fragment_id in item.source_fragment_ids
            if fragment_id in fragment_by_id
        }
        reviewed_count = sum(item.review_state in {"reviewed", "accepted", "edited"} for item in linked)
        contradiction_count = len(contradiction_by_opportunity[opportunity.id])
        if contradiction_count:
            priority_band = "challenge-before-prioritizing"
        elif len(source_ids) < 2:
            priority_band = "collect-more-evidence"
        elif reviewed_count < len(linked):
            priority_band = "finish-human-review"
        else:
            priority_band = "ready-for-decision-review"
        opportunity_rows.append({
            "id": opportunity.id,
            "workspace_id": opportunity.workspace_id,
            "workspace_name": workspace_by_id[opportunity.workspace_id].name,
            "title": opportunity.title,
            "body": opportunity.body,
            "review_state": opportunity.review_state,
            "linked_evidence_count": len(linked),
            "reviewed_evidence_count": reviewed_count,
            "source_count": len(source_ids),
            "contradiction_count": contradiction_count,
            "priority_band": priority_band,
            "created_at": opportunity.created_at,
        })
    priority_order = {
        "ready-for-decision-review": 0,
        "finish-human-review": 1,
        "collect-more-evidence": 2,
        "challenge-before-prioritizing": 3,
    }
    opportunity_rows.sort(key=lambda item: (priority_order[item["priority_band"]], -item["source_count"], -item["linked_evidence_count"]))

    search_results = []
    if q:
        for source in sources:
            if _contains(q, source.name, source.participant, source.channel, source.raw_text):
                search_results.append({
                    "kind": "source",
                    "id": source.id,
                    "workspace_id": source.workspace_id,
                    "workspace_name": workspace_by_id[source.workspace_id].name,
                    "title": source.name,
                    "excerpt": source.raw_text[:320],
                    "source_fragment_ids": [fragment.id for fragment in fragments if fragment.source_document_id == source.id][:8],
                })
        for item in evidence:
            if not item.excluded and _contains(q, item.title, item.body, item.kind):
                search_results.append({
                    "kind": "evidence",
                    "id": item.id,
                    "workspace_id": item.workspace_id,
                    "workspace_name": workspace_by_id[item.workspace_id].name,
                    "title": item.title,
                    "excerpt": item.body[:320],
                    "source_fragment_ids": item.source_fragment_ids,
                })
        for cluster in active_clusters:
            if _contains(q, cluster.label):
                search_results.append({
                    "kind": "cluster",
                    "id": cluster.id,
                    "workspace_id": cluster.workspace_id,
                    "workspace_name": workspace_by_id[cluster.workspace_id].name,
                    "title": cluster.label,
                    "excerpt": f"{len(members_by_cluster[cluster.id])} linked evidence items",
                    "source_fragment_ids": [],
                })
        for opportunity in active_opportunities:
            if _contains(q, opportunity.title, opportunity.body):
                linked_fragment_ids = list(dict.fromkeys(
                    fragment_id
                    for evidence_id in opportunity.evidence_item_ids
                    if evidence_id in evidence_by_id
                    for fragment_id in evidence_by_id[evidence_id].source_fragment_ids
                ))
                search_results.append({
                    "kind": "opportunity",
                    "id": opportunity.id,
                    "workspace_id": opportunity.workspace_id,
                    "workspace_name": workspace_by_id[opportunity.workspace_id].name,
                    "title": opportunity.title,
                    "excerpt": opportunity.body[:320],
                    "source_fragment_ids": linked_fragment_ids,
                })
        search_results = search_results[:80]

    return {
        "workspace_count": len(workspaces),
        "workspaces": workspace_rows,
        "themes": theme_rows,
        "latest_comparison": latest_comparison,
        "backlog": backlog,
        "opportunities": opportunity_rows,
        "search_results": search_results,
    }
