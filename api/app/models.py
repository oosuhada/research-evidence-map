from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def uid() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


class LocalIdentity(Base):
    __tablename__ = "local_identities"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    label: Mapped[str] = mapped_column(String(120), default="Local researcher")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Workspace(Base):
    __tablename__ = "workspaces"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("local_identities.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    mode: Mapped[str] = mapped_column(String(32), default="local-demo")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SourceDocument(Base):
    __tablename__ = "source_documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(240))
    source_type: Mapped[str] = mapped_column(String(40), default="interview")
    participant: Mapped[str | None] = mapped_column(String(160), nullable=True)
    channel: Mapped[str | None] = mapped_column(String(160), nullable=True)
    source_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    detected_encoding: Mapped[str] = mapped_column(String(40), default="utf-8")
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    raw_text: Mapped[str] = mapped_column(Text)
    sensitive_warning: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SourceFragment(Base):
    __tablename__ = "source_fragments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    source_document_id: Mapped[str] = mapped_column(ForeignKey("source_documents.id", ondelete="CASCADE"), index=True)
    ordinal: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    locator: Mapped[str] = mapped_column(String(180))
    char_start: Mapped[int] = mapped_column(Integer, default=0)
    char_end: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (UniqueConstraint("source_document_id", "ordinal", name="uq_fragment_ordinal"),)


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(80))
    model: Mapped[str] = mapped_column(String(120))
    prompt_version: Mapped[str] = mapped_column(String(40), default="extract-v1")
    schema_version: Mapped[str] = mapped_column(String(40), default="evidence-v1")
    status: Mapped[str] = mapped_column(String(32), default="running")
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_input: Mapped[int] = mapped_column(Integer, default=0)
    token_output: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EvidenceItem(Base):
    __tablename__ = "evidence_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    analysis_run_id: Mapped[str | None] = mapped_column(ForeignKey("analysis_runs.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(220))
    body: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(60), default="Pain Point")
    source_fragment_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    extraction_status: Mapped[str] = mapped_column(String(32), default="extracted")
    review_state: Mapped[str] = mapped_column(String(32), default="proposed")
    provider: Mapped[str] = mapped_column(String(80), default="human")
    model: Mapped[str] = mapped_column(String(120), default="human")
    prompt_version: Mapped[str] = mapped_column(String(40), default="human-v1")
    schema_version: Mapped[str] = mapped_column(String(40), default="evidence-v1")
    version: Mapped[int] = mapped_column(Integer, default=1)
    superseded_by_id: Mapped[str | None] = mapped_column(ForeignKey("evidence_items.id", ondelete="SET NULL"), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    excluded: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Cluster(Base):
    __tablename__ = "clusters"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    analysis_run_id: Mapped[str | None] = mapped_column(ForeignKey("analysis_runs.id", ondelete="SET NULL"), nullable=True)
    label: Mapped[str] = mapped_column(String(180))
    review_state: Mapped[str] = mapped_column(String(32), default="proposed")
    provider: Mapped[str] = mapped_column(String(80), default="human")
    model: Mapped[str] = mapped_column(String(120), default="human")
    prompt_version: Mapped[str] = mapped_column(String(40), default="cluster-v1")
    schema_version: Mapped[str] = mapped_column(String(40), default="cluster-v1")
    version: Mapped[int] = mapped_column(Integer, default=1)
    superseded_by_id: Mapped[str | None] = mapped_column(ForeignKey("clusters.id", ondelete="SET NULL"), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ClusterMembership(Base):
    __tablename__ = "cluster_memberships"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    cluster_id: Mapped[str] = mapped_column(ForeignKey("clusters.id", ondelete="CASCADE"), index=True)
    evidence_item_id: Mapped[str] = mapped_column(ForeignKey("evidence_items.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (UniqueConstraint("cluster_id", "evidence_item_id", name="uq_cluster_member"),)


class Opportunity(Base):
    __tablename__ = "opportunities"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(220))
    body: Mapped[str] = mapped_column(Text)
    evidence_item_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    review_state: Mapped[str] = mapped_column(String(32), default="proposed")
    provider: Mapped[str] = mapped_column(String(80), default="human")
    model: Mapped[str] = mapped_column(String(120), default="human")
    prompt_version: Mapped[str] = mapped_column(String(40), default="opportunity-v1")
    schema_version: Mapped[str] = mapped_column(String(40), default="opportunity-v1")
    version: Mapped[int] = mapped_column(Integer, default=1)
    superseded_by_id: Mapped[str | None] = mapped_column(ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Claim(Base):
    __tablename__ = "claims"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    opportunity_id: Mapped[str | None] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=True)
    text: Mapped[str] = mapped_column(Text)
    source_fragment_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Contradiction(Base):
    __tablename__ = "contradictions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    opportunity_id: Mapped[str | None] = mapped_column(ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True)
    evidence_item_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    note: Mapped[str] = mapped_column(Text)
    review_state: Mapped[str] = mapped_column(String(32), default="reviewed")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ChallengeRun(Base):
    __tablename__ = "challenge_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    opportunity_id: Mapped[str] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    response: Mapped[str] = mapped_column(Text, default="")
    provider: Mapped[str] = mapped_column(String(80))
    model: Mapped[str] = mapped_column(String(120))
    prompt_version: Mapped[str] = mapped_column(String(40), default="challenge-v1")
    schema_version: Mapped[str] = mapped_column(String(40), default="challenge-v1")
    source_fragment_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    extraction_status: Mapped[str] = mapped_column(String(32), default="extracted")
    review_state: Mapped[str] = mapped_column(String(32), default="proposed")
    superseded_by_id: Mapped[str | None] = mapped_column(ForeignKey("challenge_runs.id", ondelete="SET NULL"), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_input: Mapped[int] = mapped_column(Integer, default=0)
    token_output: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class HumanEdit(Base):
    __tablename__ = "human_edits"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[str] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(60))
    before_json: Mapped[dict] = mapped_column(JSON, default=dict)
    after_json: Mapped[dict] = mapped_column(JSON, default=dict)
    undone: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ExportRecord(Base):
    __tablename__ = "exports"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    format: Mapped[str] = mapped_column(String(32))
    filter_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ShareLink(Base):
    __tablename__ = "share_links"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    token: Mapped[str] = mapped_column(String(80), unique=True, index=True, default=uid)
    filter_json: Mapped[dict] = mapped_column(JSON, default=dict)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
