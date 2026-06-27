import { describe, expect, it } from 'vitest';
import { buildMapSvg } from '../features/exports/map-export';
import type { WorkspaceDetail } from '../schemas/domain';

const detail = {
  workspace: { id: 'workspace-1', name: 'Test & Learn', description: '', mode: 'local-demo', created_at: '', updated_at: '' },
  sources: [], fragments: [], analysis_runs: [], contradictions: [], challenges: [], decisions: [], human_edits: [], shares: [], retention_days: 30,
  evidence: [{ id: 'e1', title: 'Exact <source> matters', body: 'body', kind: 'Pain Point', source_fragment_ids: [], extraction_status: 'extracted', review_state: 'accepted', provider: 'deterministic', model: 'm', prompt_version: 'p', schema_version: 's', version: 1, superseded_by_id: null, failure_reason: null, excluded: false, created_at: '', updated_at: '' }],
  clusters: [{ id: 'c1', label: 'Traceability', review_state: 'accepted', provider: 'human', model: 'human', prompt_version: 'p', schema_version: 's', version: 1, superseded_by_id: null, failure_reason: null, evidence_item_ids: ['e1'] }],
  opportunities: [],
} satisfies WorkspaceDetail;

describe('map export', () => {
  it('builds standalone escaped SVG from persistent workspace data', () => {
    const svg = buildMapSvg(detail);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Test &amp; Learn');
    expect(svg).toContain('Exact &lt;source&gt; matters');
    expect(svg).toContain('Traceability');
  });
});
