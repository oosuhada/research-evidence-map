import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUpRight, Check, Filter, Link2, Search, ShieldAlert } from 'lucide-react';
import { api } from '../../api/client';
import { useLocale } from '../../i18n/LocaleContext';
import type { WorkspaceDetail } from '../../schemas/domain';
import { useWorkspaceUi } from '../../state/workspace-context';

type Props = {
  detail: WorkspaceDetail;
  onInspect: (id: string) => void;
  onChanged: () => Promise<void>;
};

export function EvidenceList({ detail, onInspect, onChanged }: Props) {
  const { text } = useLocale();
  const parentRef = useRef<HTMLDivElement | null>(null);
  const { state, dispatch } = useWorkspaceUi();
  const [query, setQuery] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'proposed' | 'reviewed'>('all');
  const [contradictionsOnly, setContradictionsOnly] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const fragmentMap = useMemo(() => new Map(detail.fragments.map((item) => [item.id, item])), [detail.fragments]);
  const sourceMap = useMemo(() => new Map(detail.sources.map((item) => [item.id, item])), [detail.sources]);
  const clusterMap = useMemo(() => {
    const result = new Map<string, string>();
    for (const cluster of detail.clusters.filter((item) => item.review_state !== 'superseded')) for (const id of cluster.evidence_item_ids) result.set(id, cluster.label);
    return result;
  }, [detail.clusters]);
  const opportunityMap = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const opportunity of detail.opportunities) for (const id of opportunity.evidence_item_ids) result.set(id, [...(result.get(id) ?? []), opportunity.title]);
    return result;
  }, [detail.opportunities]);
  const contradictionIds = useMemo(() => new Set(detail.contradictions.flatMap((item) => item.evidence_item_ids)), [detail.contradictions]);
  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return detail.evidence.filter((item) => {
      if (item.review_state === 'superseded') return false;
      if (reviewFilter === 'proposed' && item.review_state !== 'proposed') return false;
      if (reviewFilter === 'reviewed' && !['reviewed', 'accepted', 'edited'].includes(item.review_state)) return false;
      if (contradictionsOnly && !contradictionIds.has(item.id)) return false;
      if (!normalized) return true;
      const fragment = fragmentMap.get(item.source_fragment_ids[0] ?? '');
      const source = fragment ? sourceMap.get(fragment.source_document_id) : undefined;
      return [item.title, item.body, source?.name, clusterMap.get(item.id), ...(opportunityMap.get(item.id) ?? [])]
        .some((value) => value?.toLowerCase().includes(normalized));
    });
  }, [clusterMap, contradictionIds, contradictionsOnly, detail.evidence, fragmentMap, opportunityMap, query, reviewFilter, sourceMap]);
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 112, overscan: 8 });

  const markSelectedReviewed = async () => {
    const ids = state.selectedEvidenceIds.filter((id) => detail.evidence.some((item) => item.id === id && item.review_state === 'proposed'));
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      await Promise.all(ids.map((id) => api.patchEvidence(id, { review_state: 'reviewed' })));
      dispatch({ type: 'clear-evidence' });
      await onChanged();
    } finally { setBulkBusy(false); }
  };

  return <section className="evidence-workflow" aria-labelledby="evidence-list-heading">
    <div className="list-heading"><div><span>{text('ACCESSIBLE CANVAS ALTERNATIVE', '접근 가능한 캔버스 대안')}</span><h2 id="evidence-list-heading">{text('Evidence List', '근거 목록')}</h2></div><p>{text(`${rows.length} evidence items · ${state.selectedEvidenceIds.length} selected`, `근거 ${rows.length}개 · ${state.selectedEvidenceIds.length}개 선택`)}</p></div>
    <div className="evidence-toolbar">
      <label><Search size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text('Search evidence, source, cluster, opportunity…', '근거, 원문, 클러스터, 기회 검색…')} /></label>
      <div><Filter size={13} /><button className={reviewFilter === 'all' ? 'active' : ''} onClick={() => setReviewFilter('all')}>{text('All', '전체')}</button><button className={reviewFilter === 'proposed' ? 'active' : ''} onClick={() => setReviewFilter('proposed')}>{text('Needs review', '검토 필요')}</button><button className={reviewFilter === 'reviewed' ? 'active' : ''} onClick={() => setReviewFilter('reviewed')}>{text('Reviewed', '검토 완료')}</button><button className={contradictionsOnly ? 'active' : ''} onClick={() => setContradictionsOnly((current) => !current)}>{text('Contradictions', '상충 근거')}</button></div>
      <button className="bulk-review-button" disabled={bulkBusy || !state.selectedEvidenceIds.length} onClick={() => void markSelectedReviewed()}><Check size={13} />{bulkBusy ? text('Updating…', '업데이트 중…') : text('Mark selected reviewed', '선택 항목 검토 완료')}</button>
    </div>
    <div className="evidence-columns" aria-hidden="true"><span>{text('Select', '선택')}</span><span>{text('Evidence', '근거')}</span><span>{text('Source', '원문')}</span><span>{text('Cluster / state', '클러스터 / 상태')}</span><span>{text('Links', '연결')}</span></div>
    <div ref={parentRef} className="evidence-virtual-list" role="list" aria-label={text('Extracted evidence', '추출된 근거')}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = rows[virtualRow.index];
          const fragment = fragmentMap.get(item.source_fragment_ids[0] ?? '');
          const source = fragment ? sourceMap.get(fragment.source_document_id) : undefined;
          const selected = state.selectedEvidenceIds.includes(item.id);
          const opportunityTitles = opportunityMap.get(item.id) ?? [];
          return <article
            key={item.id}
            className={`evidence-row ${item.excluded ? 'is-excluded' : ''}`}
            role="listitem"
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
          >
            <label className="row-select"><input type="checkbox" aria-label={text(`Select evidence: ${item.title}`, `근거 선택: ${item.title}`)} checked={selected} onChange={() => dispatch({ type: 'toggle-evidence', id: item.id })} /><span>{selected ? <Check size={13} /> : null}</span></label>
            <button className="row-main" onClick={() => onInspect(item.id)}><b>{item.title}</b><p>{item.body}</p></button>
            <div className="row-source"><b>{source?.name ?? text('Unknown source', '알 수 없는 원문')}</b><span>{fragment?.locator ?? text('No locator', '위치 정보 없음')}</span>{source?.sensitive_warning ? <em><ShieldAlert size={12} /> {text('sensitive', '민감정보')}</em> : null}</div>
            <div className="row-state"><b>{clusterMap.get(item.id) ?? text('Unclustered', '미분류')}</b><span className={`review-chip state-${item.review_state}`}>{item.review_state}</span><small>{item.provider === 'human' ? text('Human', '사람') : `AI · ${item.model}`}</small></div>
            <div className="row-links">{contradictionIds.has(item.id) ? <span className="contradiction-chip">{text('contradiction', '상충')}</span> : null}{opportunityTitles.slice(0, 2).map((title) => <span key={title}><Link2 size={11} />{title}</span>)}<button onClick={() => onInspect(item.id)} aria-label={text(`Inspect ${item.title}`, `${item.title} 상세 보기`)}><ArrowUpRight size={15} /></button></div>
          </article>;
        })}
      </div>
    </div>
  </section>;
}
