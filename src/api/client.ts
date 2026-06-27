import { z, type ZodType } from 'zod';
import {
  analysisSchema,
  decisionSchema,
  evidenceSchema,
  humanEditSchema,
  importPreviewSchema,
  opportunitySchema,
  researchMemorySchema,
  shareSchema,
  workspaceDetailSchema,
  workspaceSummarySchema,
  type ImportDocument,
  type ReviewState,
} from '../schemas/domain';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, typeof payload.detail === 'string' ? payload.detail : JSON.stringify(payload.detail));
  }
  const payload = await response.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, `API schema mismatch: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  }
  return parsed.data;
}

async function noContent(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, payload.detail ?? response.statusText);
  }
}

export const api = {
  listWorkspaces: (signal?: AbortSignal) => request('/workspaces', z.array(workspaceSummarySchema), { signal }),
  getResearchMemory: (query = '', signal?: AbortSignal) => request(`/research-memory${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`, researchMemorySchema, { signal }),
  createWorkspace: (name: string, description: string) => request('/workspaces', workspaceSummarySchema, {
    method: 'POST', body: JSON.stringify({ name, description }),
  }),
  deleteWorkspace: (workspaceId: string) => noContent(`/workspaces/${workspaceId}`, { method: 'DELETE' }),
  getWorkspace: (workspaceId: string, signal?: AbortSignal) => request(`/workspaces/${workspaceId}`, workspaceDetailSchema, { signal }),
  getShare: (token: string, signal?: AbortSignal) => request(`/shares/${token}`, workspaceDetailSchema, { signal }),
  previewImport: (workspaceId: string, documents: ImportDocument[], signal?: AbortSignal) => request(`/workspaces/${workspaceId}/sources/preview`, importPreviewSchema, {
    method: 'POST', body: JSON.stringify({ documents }), signal,
  }),
  commitImport: (workspaceId: string, documents: ImportDocument[], confirmedSensitiveData: boolean) => request(`/workspaces/${workspaceId}/sources`, workspaceDetailSchema, {
    method: 'POST', body: JSON.stringify({ documents, confirmed_sensitive_data: confirmedSensitiveData }),
  }),
  deleteSource: (workspaceId: string, sourceId: string) => noContent(`/workspaces/${workspaceId}/sources/${sourceId}`, { method: 'DELETE' }),
  analyze: (workspaceId: string, sourceDocumentIds?: string[]) => request(`/workspaces/${workspaceId}/analysis`, analysisSchema, {
    method: 'POST', body: JSON.stringify({ source_document_ids: sourceDocumentIds ?? null }),
  }),
  cancelAnalysis: (workspaceId: string, runId: string) => request(`/workspaces/${workspaceId}/analysis/${runId}/cancel`, analysisSchema, { method: 'POST' }),
  patchEvidence: (evidenceId: string, patch: { title?: string; body?: string; review_state?: ReviewState; excluded?: boolean; cluster_id?: string | null }) => request(`/evidence/${evidenceId}`, evidenceSchema, {
    method: 'PATCH', body: JSON.stringify(patch),
  }),
  createCluster: async (workspaceId: string, label: string, evidenceItemIds: string[]) => request(`/workspaces/${workspaceId}/clusters`, z.object({ id: z.string() }), {
    method: 'POST', body: JSON.stringify({ label, evidence_item_ids: evidenceItemIds }),
  }),
  mergeClusters: (workspaceId: string, clusterIds: string[], label: string) => request(`/workspaces/${workspaceId}/clusters/merge`, z.object({ id: z.string() }), {
    method: 'POST', body: JSON.stringify({ cluster_ids: clusterIds, label }),
  }),
  splitCluster: (workspaceId: string, clusterId: string, groups: Array<{ label: string; evidence_item_ids: string[] }>) => request(`/workspaces/${workspaceId}/clusters/${clusterId}/split`, z.object({ ids: z.array(z.string()) }), {
    method: 'POST', body: JSON.stringify({ groups }),
  }),
  createOpportunity: (workspaceId: string, title: string, body: string, evidenceItemIds: string[]) => request(`/workspaces/${workspaceId}/opportunities`, opportunitySchema, {
    method: 'POST', body: JSON.stringify({ title, body, evidence_item_ids: evidenceItemIds }),
  }),
  challengeOpportunity: (workspaceId: string, opportunityId: string) => request(`/workspaces/${workspaceId}/opportunities/${opportunityId}/challenge`, z.object({
    id: z.string(), opportunity_id: z.string(), response: z.string(), provider: z.string(), model: z.string(), prompt_version: z.string(), schema_version: z.string(), source_fragment_ids: z.array(z.string()), extraction_status: z.string(), review_state: z.string(), failure_reason: z.string().nullable(), token_input: z.number(), token_output: z.number(), cost_usd: z.number(), created_at: z.string(),
  }), { method: 'POST' }),
  addContradiction: (workspaceId: string, note: string, evidenceItemIds: string[], opportunityId?: string) => request(`/workspaces/${workspaceId}/contradictions`, z.object({
    id: z.string(), opportunity_id: z.string().nullable(), evidence_item_ids: z.array(z.string()), note: z.string(), review_state: z.string(), created_at: z.string(),
  }), { method: 'POST', body: JSON.stringify({ note, evidence_item_ids: evidenceItemIds, opportunity_id: opportunityId ?? null }) }),
  recordDecision: (workspaceId: string, opportunityId: string, outcome: 'proceed' | 'experiment' | 'hold' | 'reject', rationale: string, nextStep: string) => request(`/workspaces/${workspaceId}/opportunities/${opportunityId}/decisions`, decisionSchema, {
    method: 'POST', body: JSON.stringify({ outcome, rationale, next_step: nextStep }),
  }),
  undo: (workspaceId: string) => request(`/workspaces/${workspaceId}/history/undo`, humanEditSchema, { method: 'POST' }),
  redo: (workspaceId: string) => request(`/workspaces/${workspaceId}/history/redo`, humanEditSchema, { method: 'POST' }),
  createShare: (workspaceId: string, filterJson: Record<string, unknown>) => request(`/workspaces/${workspaceId}/shares`, shareSchema, {
    method: 'POST', body: JSON.stringify({ filter_json: filterJson }),
  }),
  revokeShare: (workspaceId: string, shareId: string) => noContent(`/workspaces/${workspaceId}/shares/${shareId}`, { method: 'DELETE' }),
  exportUrl: (workspaceId: string, kind: 'evidence.csv' | 'report.md') => `${API_BASE}/workspaces/${workspaceId}/exports/${kind}`,
};
