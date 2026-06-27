from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


ReviewState = Literal["proposed", "reviewed", "accepted", "edited", "rejected", "superseded"]
DecisionOutcome = Literal["proceed", "experiment", "hold", "reject"]


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=3000)


class ImportDocumentInput(BaseModel):
    name: str = Field(min_length=1, max_length=240)
    source_type: str = "interview"
    participant: str | None = None
    channel: str | None = None
    created_date: datetime | None = None
    detected_encoding: str = "utf-8"
    content: str = Field(min_length=1)


class ImportPreviewRequest(BaseModel):
    documents: list[ImportDocumentInput] = Field(min_length=1, max_length=100)


class ImportCommitRequest(ImportPreviewRequest):
    confirmed_sensitive_data: bool = False


class AnalysisRequest(BaseModel):
    source_document_ids: list[str] | None = None


class EvidencePatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=220)
    body: str | None = Field(default=None, min_length=1)
    review_state: ReviewState | None = None
    excluded: bool | None = None
    cluster_id: str | None = None


class ClusterCreate(BaseModel):
    label: str = Field(min_length=1, max_length=180)
    evidence_item_ids: list[str] = Field(default_factory=list)


class ClusterMergeRequest(BaseModel):
    cluster_ids: list[str] = Field(min_length=2)
    label: str = Field(min_length=1, max_length=180)


class ClusterSplitRequest(BaseModel):
    groups: list[ClusterCreate] = Field(min_length=2)


class OpportunityCreate(BaseModel):
    title: str = Field(min_length=1, max_length=220)
    body: str = Field(min_length=1)
    evidence_item_ids: list[str] = Field(min_length=1)


class ContradictionCreate(BaseModel):
    note: str = Field(min_length=1)
    evidence_item_ids: list[str] = Field(min_length=1)
    opportunity_id: str | None = None


class DecisionCreate(BaseModel):
    outcome: DecisionOutcome
    rationale: str = Field(min_length=1, max_length=5000)
    next_step: str = Field(default="", max_length=3000)


class ShareCreate(BaseModel):
    filter_json: dict = Field(default_factory=dict)


class Entity(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class WorkspaceSummary(Entity):
    id: str
    name: str
    description: str
    mode: str
    created_at: datetime
    updated_at: datetime


class SourceOut(Entity):
    id: str
    name: str
    source_type: str
    participant: str | None
    channel: str | None
    source_created_at: datetime | None
    detected_encoding: str
    content_hash: str
    sensitive_warning: bool
    created_at: datetime


class FragmentOut(Entity):
    id: str
    source_document_id: str
    ordinal: int
    text: str
    locator: str
    char_start: int
    char_end: int


class EvidenceOut(Entity):
    id: str
    title: str
    body: str
    kind: str
    source_fragment_ids: list[str]
    extraction_status: str
    review_state: str
    provider: str
    model: str
    prompt_version: str
    schema_version: str
    version: int
    superseded_by_id: str | None
    failure_reason: str | None
    excluded: bool
    created_at: datetime
    updated_at: datetime


class ClusterOut(Entity):
    id: str
    label: str
    review_state: str
    provider: str
    model: str
    prompt_version: str
    schema_version: str
    version: int
    superseded_by_id: str | None
    failure_reason: str | None
    evidence_item_ids: list[str] = Field(default_factory=list)


class OpportunityOut(Entity):
    id: str
    title: str
    body: str
    evidence_item_ids: list[str]
    review_state: str
    provider: str
    model: str
    prompt_version: str
    schema_version: str
    version: int
    superseded_by_id: str | None
    failure_reason: str | None
    created_at: datetime


class ContradictionOut(Entity):
    id: str
    opportunity_id: str | None
    evidence_item_ids: list[str]
    note: str
    review_state: str
    created_at: datetime


class ChallengeOut(Entity):
    id: str
    opportunity_id: str
    response: str
    provider: str
    model: str
    prompt_version: str
    schema_version: str
    source_fragment_ids: list[str]
    extraction_status: str
    review_state: str
    failure_reason: str | None
    token_input: int
    token_output: int
    cost_usd: float
    created_at: datetime


class DecisionOut(Entity):
    id: str
    workspace_id: str
    opportunity_id: str
    outcome: str
    rationale: str
    next_step: str
    evidence_item_ids: list[str]
    source_fragment_ids: list[str]
    contradiction_ids: list[str]
    challenge_run_ids: list[str]
    reviewed_evidence_count: int
    unresolved_evidence_count: int
    version: int
    supersedes_decision_id: str | None
    created_at: datetime


class AnalysisOut(Entity):
    id: str
    provider: str
    model: str
    prompt_version: str
    schema_version: str
    status: str
    failure_reason: str | None
    token_input: int
    token_output: int
    cost_usd: float
    started_at: datetime
    completed_at: datetime | None
    cancelled_at: datetime | None


class HumanEditOut(Entity):
    id: str
    entity_type: str
    entity_id: str
    action: str
    before_json: dict
    after_json: dict
    undone: bool
    created_at: datetime


class ShareOut(Entity):
    id: str
    token: str
    filter_json: dict
    revoked: bool
    created_at: datetime


class WorkspaceDetail(BaseModel):
    workspace: WorkspaceSummary
    sources: list[SourceOut]
    fragments: list[FragmentOut]
    analysis_runs: list[AnalysisOut]
    evidence: list[EvidenceOut]
    clusters: list[ClusterOut]
    opportunities: list[OpportunityOut]
    contradictions: list[ContradictionOut]
    challenges: list[ChallengeOut]
    decisions: list[DecisionOut]
    human_edits: list[HumanEditOut]
    shares: list[ShareOut]
    retention_days: int
