import { z } from 'zod';

export const reviewStateSchema = z.enum(['proposed', 'reviewed', 'accepted', 'edited', 'rejected', 'superseded']);

export const workspaceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  mode: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const sourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  source_type: z.string(),
  participant: z.string().nullable(),
  channel: z.string().nullable(),
  source_created_at: z.string().nullable(),
  detected_encoding: z.string(),
  content_hash: z.string(),
  sensitive_warning: z.boolean(),
  created_at: z.string(),
});

export const fragmentSchema = z.object({
  id: z.string(),
  source_document_id: z.string(),
  ordinal: z.number(),
  text: z.string(),
  locator: z.string(),
  char_start: z.number(),
  char_end: z.number(),
});

export const analysisSchema = z.object({
  id: z.string(),
  provider: z.string(),
  model: z.string(),
  prompt_version: z.string(),
  schema_version: z.string(),
  status: z.string(),
  failure_reason: z.string().nullable(),
  token_input: z.number(),
  token_output: z.number(),
  cost_usd: z.number(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
});

export const evidenceSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  kind: z.string(),
  source_fragment_ids: z.array(z.string()),
  extraction_status: z.string(),
  review_state: reviewStateSchema,
  provider: z.string(),
  model: z.string(),
  prompt_version: z.string(),
  schema_version: z.string(),
  version: z.number(),
  superseded_by_id: z.string().nullable(),
  failure_reason: z.string().nullable(),
  excluded: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const clusterSchema = z.object({
  id: z.string(),
  label: z.string(),
  review_state: reviewStateSchema,
  provider: z.string(),
  model: z.string(),
  prompt_version: z.string(),
  schema_version: z.string(),
  version: z.number(),
  superseded_by_id: z.string().nullable(),
  failure_reason: z.string().nullable(),
  evidence_item_ids: z.array(z.string()),
});

export const opportunitySchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  evidence_item_ids: z.array(z.string()),
  review_state: reviewStateSchema,
  provider: z.string(),
  model: z.string(),
  prompt_version: z.string(),
  schema_version: z.string(),
  version: z.number(),
  superseded_by_id: z.string().nullable(),
  failure_reason: z.string().nullable(),
  created_at: z.string(),
});

export const contradictionSchema = z.object({
  id: z.string(),
  opportunity_id: z.string().nullable(),
  evidence_item_ids: z.array(z.string()),
  note: z.string(),
  review_state: z.string(),
  created_at: z.string(),
});

export const challengeSchema = z.object({
  id: z.string(),
  opportunity_id: z.string(),
  response: z.string(),
  provider: z.string(),
  model: z.string(),
  prompt_version: z.string(),
  schema_version: z.string(),
  source_fragment_ids: z.array(z.string()),
  extraction_status: z.string(),
  review_state: z.string(),
  failure_reason: z.string().nullable(),
  token_input: z.number(),
  token_output: z.number(),
  cost_usd: z.number(),
  created_at: z.string(),
});

export const humanEditSchema = z.object({
  id: z.string(),
  entity_type: z.string(),
  entity_id: z.string(),
  action: z.string(),
  before_json: z.record(z.string(), z.unknown()),
  after_json: z.record(z.string(), z.unknown()),
  undone: z.boolean(),
  created_at: z.string(),
});

export const shareSchema = z.object({
  id: z.string(),
  token: z.string(),
  filter_json: z.record(z.string(), z.unknown()),
  revoked: z.boolean(),
  created_at: z.string(),
});

export const workspaceDetailSchema = z.object({
  workspace: workspaceSummarySchema,
  sources: z.array(sourceSchema),
  fragments: z.array(fragmentSchema),
  analysis_runs: z.array(analysisSchema),
  evidence: z.array(evidenceSchema),
  clusters: z.array(clusterSchema),
  opportunities: z.array(opportunitySchema),
  contradictions: z.array(contradictionSchema),
  challenges: z.array(challengeSchema),
  human_edits: z.array(humanEditSchema),
  shares: z.array(shareSchema),
  retention_days: z.number(),
});

export const importPreviewSchema = z.object({
  documents: z.array(z.object({
    name: z.string(),
    source_type: z.string(),
    participant: z.string().nullable(),
    channel: z.string().nullable(),
    created_date: z.string().nullable(),
    detected_encoding: z.string(),
    content_hash: z.string(),
    duplicate: z.boolean(),
    sensitive_warning: z.boolean(),
    fragment_count: z.number(),
    fragment_preview: z.array(z.string()),
  })),
  retention_days: z.number(),
  analysis_started: z.boolean(),
});

export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;
export type WorkspaceDetail = z.infer<typeof workspaceDetailSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Cluster = z.infer<typeof clusterSchema>;
export type Opportunity = z.infer<typeof opportunitySchema>;
export type ImportPreview = z.infer<typeof importPreviewSchema>;
export type ReviewState = z.infer<typeof reviewStateSchema>;

export type ImportDocument = {
  name: string;
  source_type: string;
  participant: string | null;
  channel: string | null;
  created_date: string | null;
  detected_encoding: string;
  content: string;
};
