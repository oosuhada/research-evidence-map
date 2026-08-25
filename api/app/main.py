from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from hashlib import sha256

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from . import models, schemas
from .config import settings
from .database import Base, engine, get_db
from .importers import contains_sensitive_data, content_hash, fragment_text, normalize_content, preview_fragment_text
from .memory import build_research_memory
from .repository import record_edit, require_workspace, workspace_detail
from .service import cancel_analysis, challenge_opportunity, create_cluster, merge_clusters, patch_evidence, redo_last, run_analysis, split_cluster, undo_last


Base.metadata.create_all(bind=engine)

app = FastAPI(title="Signal Garden API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def not_found(exc: KeyError) -> HTTPException:
    return HTTPException(status_code=404, detail=str(exc).strip("'"))


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "mode": "local-demo" if settings.ai_provider == "deterministic" else "provider", "provider": settings.ai_provider}


@app.get("/api/workspaces", response_model=list[schemas.WorkspaceSummary])
def list_workspaces(db: Session = Depends(get_db)):
    return db.scalars(select(models.Workspace).where(models.Workspace.deleted_at.is_(None)).order_by(models.Workspace.updated_at.desc())).all()


@app.get("/api/research-memory")
def research_memory(q: str = Query(default="", max_length=300), db: Session = Depends(get_db)) -> dict:
    return build_research_memory(db, q)


@app.post("/api/workspaces", response_model=schemas.WorkspaceSummary, status_code=201)
def create_workspace(payload: schemas.WorkspaceCreate, db: Session = Depends(get_db)):
    identity = db.scalar(select(models.LocalIdentity).limit(1))
    if identity is None:
        identity = models.LocalIdentity()
        db.add(identity)
        db.flush()
    workspace = models.Workspace(owner_id=identity.id, name=payload.name, description=payload.description)
    db.add(workspace)
    db.commit()
    return workspace


@app.get("/api/workspaces/{workspace_id}", response_model=schemas.WorkspaceDetail)
def get_workspace(workspace_id: str, db: Session = Depends(get_db)):
    try:
        return workspace_detail(db, workspace_id)
    except KeyError as exc:
        raise not_found(exc)


@app.delete("/api/workspaces/{workspace_id}", status_code=204)
def delete_workspace(workspace_id: str, db: Session = Depends(get_db)):
    try:
        workspace = require_workspace(db, workspace_id)
    except KeyError as exc:
        raise not_found(exc)
    workspace.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return Response(status_code=204)


@app.post("/api/workspaces/{workspace_id}/sources/preview")
def preview_sources(workspace_id: str, payload: schemas.ImportPreviewRequest, db: Session = Depends(get_db)):
    try:
        require_workspace(db, workspace_id)
    except KeyError as exc:
        raise not_found(exc)
    existing_hashes = set(db.scalars(select(models.SourceDocument.content_hash).where(models.SourceDocument.workspace_id == workspace_id)).all())
    previews = []
    for document in payload.documents:
        normalized = normalize_content(document.name, document.content)
        fragments = fragment_text(normalized)
        digest = content_hash(normalized)
        previews.append({
            "name": document.name,
            "source_type": document.source_type,
            "participant": document.participant,
            "channel": document.channel,
            "created_date": document.created_date,
            "detected_encoding": document.detected_encoding,
            "content_hash": digest,
            "duplicate": digest in existing_hashes,
            "sensitive_warning": contains_sensitive_data(normalized),
            "fragment_count": len(fragments),
            "fragment_preview": [preview_fragment_text(item.text) for item in fragments[:3]],
        })
    return {"documents": previews, "retention_days": settings.retention_days, "analysis_started": False}


@app.post("/api/workspaces/{workspace_id}/sources", response_model=schemas.WorkspaceDetail, status_code=201)
def commit_sources(workspace_id: str, payload: schemas.ImportCommitRequest, db: Session = Depends(get_db)):
    try:
        workspace = require_workspace(db, workspace_id)
    except KeyError as exc:
        raise not_found(exc)
    existing_hashes = set(db.scalars(select(models.SourceDocument.content_hash).where(models.SourceDocument.workspace_id == workspace_id)).all())
    for incoming in payload.documents:
        normalized = normalize_content(incoming.name, incoming.content)
        digest = content_hash(normalized)
        if digest in existing_hashes:
            continue
        sensitive = contains_sensitive_data(normalized)
        if sensitive and not payload.confirmed_sensitive_data:
            raise HTTPException(status_code=409, detail=f"Sensitive-data warning must be acknowledged before importing {incoming.name}")
        source = models.SourceDocument(
            workspace_id=workspace_id,
            name=incoming.name,
            source_type=incoming.source_type,
            participant=incoming.participant,
            channel=incoming.channel,
            source_created_at=incoming.created_date,
            detected_encoding=incoming.detected_encoding,
            content_hash=digest,
            raw_text=normalized,
            sensitive_warning=sensitive,
        )
        db.add(source)
        db.flush()
        for fragment in fragment_text(normalized):
            db.add(models.SourceFragment(
                source_document_id=source.id,
                ordinal=fragment.ordinal,
                text=fragment.text,
                locator=fragment.locator,
                char_start=fragment.char_start,
                char_end=fragment.char_end,
            ))
        existing_hashes.add(digest)
    workspace.updated_at = datetime.now(timezone.utc)
    db.commit()
    return workspace_detail(db, workspace_id)


@app.delete("/api/workspaces/{workspace_id}/sources/{source_id}", status_code=204)
def delete_source(workspace_id: str, source_id: str, db: Session = Depends(get_db)):
    source = db.get(models.SourceDocument, source_id)
    if source is None or source.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="source not found")
    db.delete(source)
    db.commit()
    return Response(status_code=204)


@app.post("/api/workspaces/{workspace_id}/analysis", response_model=schemas.AnalysisOut, status_code=201)
def analyze(workspace_id: str, payload: schemas.AnalysisRequest, db: Session = Depends(get_db)):
    try:
        return run_analysis(db, workspace_id, payload.source_document_ids)
    except KeyError as exc:
        raise not_found(exc)


@app.post("/api/workspaces/{workspace_id}/analysis/{run_id}/cancel", response_model=schemas.AnalysisOut)
def cancel(workspace_id: str, run_id: str, db: Session = Depends(get_db)):
    try:
        return cancel_analysis(db, workspace_id, run_id)
    except KeyError as exc:
        raise not_found(exc)


@app.patch("/api/evidence/{evidence_id}", response_model=schemas.EvidenceOut)
def update_evidence(evidence_id: str, payload: schemas.EvidencePatch, db: Session = Depends(get_db)):
    try:
        return patch_evidence(db, evidence_id, payload.model_dump(exclude_unset=True))
    except KeyError as exc:
        raise not_found(exc)


@app.post("/api/workspaces/{workspace_id}/clusters", status_code=201)
def add_cluster(workspace_id: str, payload: schemas.ClusterCreate, db: Session = Depends(get_db)):
    try:
        cluster = create_cluster(db, workspace_id, payload.label, payload.evidence_item_ids)
        return {"id": cluster.id}
    except KeyError as exc:
        raise not_found(exc)


@app.post("/api/workspaces/{workspace_id}/clusters/merge", status_code=201)
def merge(workspace_id: str, payload: schemas.ClusterMergeRequest, db: Session = Depends(get_db)):
    try:
        cluster = merge_clusters(db, workspace_id, payload.cluster_ids, payload.label)
        return {"id": cluster.id}
    except KeyError as exc:
        raise not_found(exc)


@app.post("/api/workspaces/{workspace_id}/clusters/{cluster_id}/split", status_code=201)
def split(workspace_id: str, cluster_id: str, payload: schemas.ClusterSplitRequest, db: Session = Depends(get_db)):
    try:
        created = split_cluster(db, workspace_id, cluster_id, [item.model_dump() for item in payload.groups])
        return {"ids": [item.id for item in created]}
    except KeyError as exc:
        raise not_found(exc)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.post("/api/workspaces/{workspace_id}/opportunities", response_model=schemas.OpportunityOut, status_code=201)
def add_opportunity(workspace_id: str, payload: schemas.OpportunityCreate, db: Session = Depends(get_db)):
    try:
        require_workspace(db, workspace_id)
    except KeyError as exc:
        raise not_found(exc)
    opportunity = models.Opportunity(
        workspace_id=workspace_id,
        title=payload.title,
        body=payload.body,
        evidence_item_ids=payload.evidence_item_ids,
        review_state="edited",
    )
    db.add(opportunity)
    db.flush()
    record_edit(db, workspace_id, "opportunity", opportunity.id, "create", {}, {"title": payload.title, "body": payload.body, "evidence_item_ids": payload.evidence_item_ids})
    db.commit()
    return opportunity


@app.post("/api/workspaces/{workspace_id}/opportunities/{opportunity_id}/challenge", response_model=schemas.ChallengeOut, status_code=201)
def challenge(workspace_id: str, opportunity_id: str, db: Session = Depends(get_db)):
    try:
        return challenge_opportunity(db, workspace_id, opportunity_id)
    except KeyError as exc:
        raise not_found(exc)


@app.post("/api/workspaces/{workspace_id}/contradictions", response_model=schemas.ContradictionOut, status_code=201)
def add_contradiction(workspace_id: str, payload: schemas.ContradictionCreate, db: Session = Depends(get_db)):
    try:
        require_workspace(db, workspace_id)
    except KeyError as exc:
        raise not_found(exc)
    item = models.Contradiction(workspace_id=workspace_id, **payload.model_dump())
    db.add(item)
    db.flush()
    record_edit(db, workspace_id, "contradiction", item.id, "create", {}, payload.model_dump())
    db.commit()
    return item


@app.post("/api/workspaces/{workspace_id}/opportunities/{opportunity_id}/decisions", response_model=schemas.DecisionOut, status_code=201)
def record_decision(workspace_id: str, opportunity_id: str, payload: schemas.DecisionCreate, db: Session = Depends(get_db)):
    try:
        require_workspace(db, workspace_id)
    except KeyError as exc:
        raise not_found(exc)

    opportunity = db.get(models.Opportunity, opportunity_id)
    if opportunity is None or opportunity.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="opportunity not found")

    evidence_rows = db.scalars(select(models.EvidenceItem).where(models.EvidenceItem.id.in_(opportunity.evidence_item_ids))).all()
    evidence_by_id = {item.id: item for item in evidence_rows}
    active_evidence = [
        evidence_by_id[evidence_id]
        for evidence_id in opportunity.evidence_item_ids
        if evidence_id in evidence_by_id
        and not evidence_by_id[evidence_id].excluded
        and evidence_by_id[evidence_id].review_state not in {"rejected", "superseded"}
    ]
    if not active_evidence:
        raise HTTPException(status_code=409, detail="Record a decision only after linking at least one active evidence item to the opportunity")

    reviewed_states = {"reviewed", "accepted", "edited"}
    reviewed_count = sum(item.review_state in reviewed_states for item in active_evidence)
    unresolved_count = len(active_evidence) - reviewed_count
    fragment_ids = list(dict.fromkeys(fragment_id for item in active_evidence for fragment_id in item.source_fragment_ids))
    contradictions = db.scalars(
        select(models.Contradiction)
        .where(models.Contradiction.workspace_id == workspace_id, models.Contradiction.opportunity_id == opportunity_id)
        .order_by(models.Contradiction.created_at)
    ).all()
    challenges = db.scalars(
        select(models.ChallengeRun)
        .where(models.ChallengeRun.workspace_id == workspace_id, models.ChallengeRun.opportunity_id == opportunity_id)
        .order_by(models.ChallengeRun.created_at)
    ).all()
    previous = db.scalar(
        select(models.DecisionRecord)
        .where(models.DecisionRecord.workspace_id == workspace_id, models.DecisionRecord.opportunity_id == opportunity_id)
        .order_by(models.DecisionRecord.version.desc())
        .limit(1)
    )

    item = models.DecisionRecord(
        workspace_id=workspace_id,
        opportunity_id=opportunity_id,
        outcome=payload.outcome,
        rationale=payload.rationale,
        next_step=payload.next_step,
        evidence_item_ids=[evidence.id for evidence in active_evidence],
        source_fragment_ids=fragment_ids,
        contradiction_ids=[contradiction.id for contradiction in contradictions],
        challenge_run_ids=[challenge.id for challenge in challenges],
        reviewed_evidence_count=reviewed_count,
        unresolved_evidence_count=unresolved_count,
        version=(previous.version + 1) if previous else 1,
        supersedes_decision_id=previous.id if previous else None,
    )
    db.add(item)
    db.flush()
    audit_payload = {
        "opportunity_id": item.opportunity_id,
        "outcome": item.outcome,
        "rationale": item.rationale,
        "next_step": item.next_step,
        "evidence_item_ids": item.evidence_item_ids,
        "source_fragment_ids": item.source_fragment_ids,
        "contradiction_ids": item.contradiction_ids,
        "challenge_run_ids": item.challenge_run_ids,
        "reviewed_evidence_count": item.reviewed_evidence_count,
        "unresolved_evidence_count": item.unresolved_evidence_count,
        "version": item.version,
        "supersedes_decision_id": item.supersedes_decision_id,
    }
    record_edit(db, workspace_id, "decision", item.id, "create", {}, audit_payload)
    db.commit()
    return item


@app.post("/api/workspaces/{workspace_id}/history/undo", response_model=schemas.HumanEditOut)
def undo(workspace_id: str, db: Session = Depends(get_db)):
    try:
        require_workspace(db, workspace_id)
        return undo_last(db, workspace_id)
    except KeyError as exc:
        raise not_found(exc)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@app.post("/api/workspaces/{workspace_id}/history/redo", response_model=schemas.HumanEditOut)
def redo(workspace_id: str, db: Session = Depends(get_db)):
    try:
        require_workspace(db, workspace_id)
        return redo_last(db, workspace_id)
    except KeyError as exc:
        raise not_found(exc)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@app.post("/api/workspaces/{workspace_id}/shares", response_model=schemas.ShareOut, status_code=201)
def create_share(workspace_id: str, payload: schemas.ShareCreate, db: Session = Depends(get_db)):
    try:
        require_workspace(db, workspace_id)
    except KeyError as exc:
        raise not_found(exc)
    link = models.ShareLink(workspace_id=workspace_id, filter_json=payload.filter_json)
    db.add(link)
    db.commit()
    return link


@app.delete("/api/workspaces/{workspace_id}/shares/{share_id}", status_code=204)
def revoke_share(workspace_id: str, share_id: str, db: Session = Depends(get_db)):
    link = db.get(models.ShareLink, share_id)
    if link is None or link.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="share link not found")
    link.revoked = True
    link.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return Response(status_code=204)


@app.get("/api/shares/{token}", response_model=schemas.WorkspaceDetail)
def shared_workspace(token: str, db: Session = Depends(get_db)):
    link = db.scalar(select(models.ShareLink).where(models.ShareLink.token == token, models.ShareLink.revoked.is_(False)))
    if link is None:
        raise HTTPException(status_code=404, detail="share link not found or revoked")
    return workspace_detail(db, link.workspace_id)


@app.get("/api/workspaces/{workspace_id}/exports/evidence.csv")
def export_evidence_csv(workspace_id: str, db: Session = Depends(get_db)):
    try:
        detail = workspace_detail(db, workspace_id)
    except KeyError as exc:
        raise not_found(exc)
    fragment_map = {item.id: item for item in detail["fragments"]}
    source_map = {item.id: item for item in detail["sources"]}
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["evidence_id", "kind", "title", "body", "review_state", "source_name", "source_locator", "provider", "model", "version"])
    for item in detail["evidence"]:
        for fragment_id in item.source_fragment_ids or [""]:
            fragment = fragment_map.get(fragment_id)
            source = source_map.get(fragment.source_document_id) if fragment else None
            writer.writerow([item.id, item.kind, item.title, item.body, item.review_state, source.name if source else "", fragment.locator if fragment else "", item.provider, item.model, item.version])
    db.add(models.ExportRecord(workspace_id=workspace_id, format="csv"))
    db.commit()
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="signal-garden-{workspace_id[:8]}-evidence.csv"'})


@app.get("/api/workspaces/{workspace_id}/exports/report.md")
def export_report(workspace_id: str, db: Session = Depends(get_db)):
    try:
        detail = workspace_detail(db, workspace_id)
    except KeyError as exc:
        raise not_found(exc)
    fragment_map = {item.id: item for item in detail["fragments"]}
    source_map = {item.id: item for item in detail["sources"]}
    workspace = detail["workspace"]
    lines = [f"# {workspace.name} — Evidence & Decision Brief", "", f"> Signal Garden export · {datetime.now(timezone.utc).isoformat()}", "", "## Opportunities", ""]
    for opportunity in detail["opportunities"]:
        lines += [f"### {opportunity.title}", "", opportunity.body, "", "Evidence:"]
        for evidence_id in opportunity.evidence_item_ids:
            evidence = next((item for item in detail["evidence"] if item.id == evidence_id), None)
            if evidence is None:
                continue
            locator_bits = []
            for fragment_id in evidence.source_fragment_ids:
                fragment = fragment_map.get(fragment_id)
                source = source_map.get(fragment.source_document_id) if fragment else None
                if fragment and source:
                    locator_bits.append(f"{source.name} · {fragment.locator}")
            lines.append(f"- **{evidence.title}** — {evidence.body}  \n  Source: {'; '.join(locator_bits) or 'unavailable'}")
        lines.append("")
    lines += ["## Human Decisions", ""]
    opportunity_map = {item.id: item for item in detail["opportunities"]}
    for decision in detail["decisions"]:
        opportunity = opportunity_map.get(decision.opportunity_id)
        lines += [
            f"### {opportunity.title if opportunity else 'Archived opportunity'} · v{decision.version}",
            "",
            f"- Outcome: **{decision.outcome}**",
            f"- Rationale: {decision.rationale}",
            f"- Next step: {decision.next_step or 'Not recorded'}",
            f"- Evidence snapshot: {len(decision.evidence_item_ids)} active · {decision.reviewed_evidence_count} human-reviewed · {decision.unresolved_evidence_count} unresolved",
            f"- Verification snapshot: {len(decision.challenge_run_ids)} challenge run(s) · {len(decision.contradiction_ids)} contradiction(s) · {len(decision.source_fragment_ids)} source fragment(s)",
            "",
        ]
    lines += ["## Reviewed Evidence", ""]
    for evidence in detail["evidence"]:
        lines.append(f"- [{evidence.review_state}] **{evidence.title}** — {evidence.body}")
    db.add(models.ExportRecord(workspace_id=workspace_id, format="markdown"))
    db.commit()
    return Response("\n".join(lines), media_type="text/markdown", headers={"Content-Disposition": f'attachment; filename="signal-garden-{workspace_id[:8]}-brief.md"'})
