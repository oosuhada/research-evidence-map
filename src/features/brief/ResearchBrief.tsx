import { Copy, Download, FileText, Link2, ShieldAlert } from 'lucide-react';
import type { WorkspaceDetail } from '../../schemas/domain';

function reviewed(state: string) {
  return ['reviewed', 'accepted', 'edited'].includes(state);
}

function buildMarkdown(detail: WorkspaceDetail) {
  const activeEvidence = detail.evidence.filter((item) => !item.excluded && item.review_state !== 'superseded');
  const reviewedEvidence = activeEvidence.filter((item) => reviewed(item.review_state));
  const clusters = detail.clusters
    .filter((item) => item.review_state !== 'superseded')
    .map((cluster) => ({ ...cluster, count: cluster.evidence_item_ids.filter((id) => activeEvidence.some((item) => item.id === id)).length }))
    .sort((a, b) => b.count - a.count);
  const opportunities = detail.opportunities.filter((item) => !['rejected', 'superseded'].includes(item.review_state));
  const contradictions = detail.contradictions.filter((item) => !['rejected', 'superseded'].includes(item.review_state));
  const lines = [
    `# ${detail.workspace.name} — Research Brief`,
    '',
    detail.workspace.description || 'No research question recorded.',
    '',
    `- Sources: ${detail.sources.length}`,
    `- Active evidence: ${activeEvidence.length}`,
    `- Human-reviewed evidence: ${reviewedEvidence.length}`,
    `- Active clusters: ${clusters.length}`,
    `- Opportunities: ${opportunities.length}`,
    `- Recorded contradictions: ${contradictions.length}`,
    '',
    '## Strongest evidence clusters',
    ...(clusters.length ? clusters.slice(0, 6).map((cluster) => `- **${cluster.label}** — ${cluster.count} linked evidence item${cluster.count === 1 ? '' : 's'}`) : ['- No clusters yet.']),
    '',
    '## Opportunity hypotheses',
    ...(opportunities.length ? opportunities.map((opportunity) => `### ${opportunity.title}\n${opportunity.body}\n\nLinked evidence: ${opportunity.evidence_item_ids.length}`) : ['No opportunities recorded yet.']),
    '',
    '## Counter-evidence / contradictions',
    ...(contradictions.length ? contradictions.map((item) => `- ${item.note}`) : ['- No contradiction has been recorded yet.']),
    '',
    '> Generated deterministically from the current workspace state. This is a research summary, not an AI confidence score.',
  ];
  return lines.join('\n');
}

export function ResearchBrief({ detail }: { detail: WorkspaceDetail }) {
  const activeEvidence = detail.evidence.filter((item) => !item.excluded && item.review_state !== 'superseded');
  const clusterRows = detail.clusters
    .filter((item) => item.review_state !== 'superseded')
    .map((cluster) => {
      const evidence = activeEvidence.filter((item) => cluster.evidence_item_ids.includes(item.id));
      const sourceIds = new Set(evidence.flatMap((item) => item.source_fragment_ids)
        .map((id) => detail.fragments.find((fragment) => fragment.id === id)?.source_document_id)
        .filter((id): id is string => Boolean(id)));
      return { cluster, evidenceCount: evidence.length, sourceCount: sourceIds.size, reviewedCount: evidence.filter((item) => reviewed(item.review_state)).length };
    })
    .sort((a, b) => b.evidenceCount - a.evidenceCount);
  const markdown = buildMarkdown(detail);

  const copy = async () => {
    await navigator.clipboard.writeText(markdown);
  };

  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${detail.workspace.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'research'}-brief.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <section id="brief" className="research-brief" aria-labelledby="research-brief-heading">
    <div className="research-brief-head"><div><span>RESEARCH BRIEF / CURRENT STATE</span><h2 id="research-brief-heading">A shareable summary that stays tied to the evidence.</h2><p>Use this after review to communicate what is supported, where it came from, and what still challenges the current interpretation.</p></div><div><button onClick={() => void copy()}><Copy size={14} /> Copy Markdown</button><button onClick={download}><Download size={14} /> Download brief</button></div></div>
    <div className="research-brief-grid">
      <article><FileText size={16} /><span>REVIEWED EVIDENCE</span><strong>{activeEvidence.filter((item) => reviewed(item.review_state)).length}</strong><small>of {activeEvidence.length} active evidence items</small></article>
      <article><Link2 size={16} /><span>ACTIVE CLUSTERS</span><strong>{clusterRows.length}</strong><small>{clusterRows.filter((row) => row.sourceCount >= 2).length} backed by 2+ independent sources</small></article>
      <article><ShieldAlert size={16} /><span>CONTRADICTIONS</span><strong>{detail.contradictions.length}</strong><small>explicit counter-evidence remains visible in the brief</small></article>
    </div>
    <div className="coverage-matrix">
      <div className="coverage-matrix-head"><span>CLUSTER</span><span>EVIDENCE</span><span>REVIEWED</span><span>SOURCES</span></div>
      {clusterRows.length ? clusterRows.slice(0, 10).map((row) => <div key={row.cluster.id}><strong>{row.cluster.label}</strong><span>{row.evidenceCount}</span><span>{row.reviewedCount}/{row.evidenceCount}</span><span>{row.sourceCount}</span></div>) : <p>No cluster coverage to summarize yet.</p>}
    </div>
  </section>;
}
