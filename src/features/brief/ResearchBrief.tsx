import { Copy, Download, FileText, Link2, ShieldAlert } from 'lucide-react';
import { useLocale, type Locale } from '../../i18n/LocaleContext';
import type { WorkspaceDetail } from '../../schemas/domain';

function reviewed(state: string) {
  return ['reviewed', 'accepted', 'edited'].includes(state);
}

function buildMarkdown(detail: WorkspaceDetail, locale: Locale) {
  const ko = locale === 'ko';
  const activeEvidence = detail.evidence.filter((item) => !item.excluded && item.review_state !== 'superseded');
  const reviewedEvidence = activeEvidence.filter((item) => reviewed(item.review_state));
  const clusters = detail.clusters
    .filter((item) => item.review_state !== 'superseded')
    .map((cluster) => ({ ...cluster, count: cluster.evidence_item_ids.filter((id) => activeEvidence.some((item) => item.id === id)).length }))
    .sort((a, b) => b.count - a.count);
  const opportunities = detail.opportunities.filter((item) => !['rejected', 'superseded'].includes(item.review_state));
  const contradictions = detail.contradictions.filter((item) => !['rejected', 'superseded'].includes(item.review_state));
  const lines = [
    `# ${detail.workspace.name} — ${ko ? '리서치 브리프' : 'Research Brief'}`,
    '',
    detail.workspace.description || (ko ? '기록된 리서치 질문이 없습니다.' : 'No research question recorded.'),
    '',
    `- ${ko ? '원문' : 'Sources'}: ${detail.sources.length}`,
    `- ${ko ? '활성 근거' : 'Active evidence'}: ${activeEvidence.length}`,
    `- ${ko ? '사람 검토 완료 근거' : 'Human-reviewed evidence'}: ${reviewedEvidence.length}`,
    `- ${ko ? '활성 클러스터' : 'Active clusters'}: ${clusters.length}`,
    `- ${ko ? '기회' : 'Opportunities'}: ${opportunities.length}`,
    `- ${ko ? '기록된 상충 근거' : 'Recorded contradictions'}: ${contradictions.length}`,
    '',
    ko ? '## 가장 강한 근거 클러스터' : '## Strongest evidence clusters',
    ...(clusters.length ? clusters.slice(0, 6).map((cluster) => ko ? `- **${cluster.label}** — 연결 근거 ${cluster.count}개` : `- **${cluster.label}** — ${cluster.count} linked evidence item${cluster.count === 1 ? '' : 's'}`) : [ko ? '- 아직 클러스터가 없습니다.' : '- No clusters yet.']),
    '',
    ko ? '## 기회 가설' : '## Opportunity hypotheses',
    ...(opportunities.length ? opportunities.map((opportunity) => `### ${opportunity.title}\n${opportunity.body}\n\n${ko ? '연결 근거' : 'Linked evidence'}: ${opportunity.evidence_item_ids.length}`) : [ko ? '아직 기록된 기회가 없습니다.' : 'No opportunities recorded yet.']),
    '',
    ko ? '## 반대 근거 / 상충' : '## Counter-evidence / contradictions',
    ...(contradictions.length ? contradictions.map((item) => `- ${item.note}`) : [ko ? '- 아직 기록된 상충 근거가 없습니다.' : '- No contradiction has been recorded yet.']),
    '',
    ko ? '> 현재 워크스페이스 상태에서 결정적으로 생성된 리서치 요약입니다. AI confidence score가 아닙니다.' : '> Generated deterministically from the current workspace state. This is a research summary, not an AI confidence score.',
  ];
  return lines.join('\n');
}

export function ResearchBrief({ detail }: { detail: WorkspaceDetail }) {
  const { locale, text } = useLocale();
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
  const markdown = buildMarkdown(detail, locale);

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
    <div className="research-brief-head"><div><span>{text('RESEARCH BRIEF / CURRENT STATE', '리서치 브리프 / 현재 상태')}</span><h2 id="research-brief-heading">{text('A shareable summary that stays tied to the evidence.', '근거와 연결된 채 공유할 수 있는 요약.')}</h2><p>{text('Use this after review to communicate what is supported, where it came from, and what still challenges the current interpretation.', '검토 후 무엇이 근거로 뒷받침되는지, 어디서 왔는지, 현재 해석을 무엇이 반박하는지 공유할 때 사용하세요.')}</p></div><div><button onClick={() => void copy()}><Copy size={14} /> {text('Copy Markdown', 'Markdown 복사')}</button><button onClick={download}><Download size={14} /> {text('Download brief', '브리프 다운로드')}</button></div></div>
    <div className="research-brief-grid">
      <article><FileText size={16} /><span>{text('REVIEWED EVIDENCE', '검토 완료 근거')}</span><strong>{activeEvidence.filter((item) => reviewed(item.review_state)).length}</strong><small>{text(`of ${activeEvidence.length} active evidence items`, `활성 근거 ${activeEvidence.length}개 중`)}</small></article>
      <article><Link2 size={16} /><span>{text('ACTIVE CLUSTERS', '활성 클러스터')}</span><strong>{clusterRows.length}</strong><small>{text(`${clusterRows.filter((row) => row.sourceCount >= 2).length} backed by 2+ independent sources`, `독립 원문 2개 이상으로 뒷받침되는 클러스터 ${clusterRows.filter((row) => row.sourceCount >= 2).length}개`)}</small></article>
      <article><ShieldAlert size={16} /><span>{text('CONTRADICTIONS', '상충 근거')}</span><strong>{detail.contradictions.length}</strong><small>{text('explicit counter-evidence remains visible in the brief', '명시적인 반대 근거가 브리프에 계속 표시됩니다')}</small></article>
    </div>
    <div className="coverage-matrix">
      <div className="coverage-matrix-head"><span>{text('CLUSTER', '클러스터')}</span><span>{text('EVIDENCE', '근거')}</span><span>{text('REVIEWED', '검토')}</span><span>{text('SOURCES', '원문')}</span></div>
      {clusterRows.length ? clusterRows.slice(0, 10).map((row) => <div key={row.cluster.id}><strong>{row.cluster.label}</strong><span>{row.evidenceCount}</span><span>{row.reviewedCount}/{row.evidenceCount}</span><span>{row.sourceCount}</span></div>) : <p>{text('No cluster coverage to summarize yet.', '아직 요약할 클러스터 커버리지가 없습니다.')}</p>}
    </div>
  </section>;
}
