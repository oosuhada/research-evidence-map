import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUpRight, Check, Filter, Link2, Search, ShieldAlert } from 'lucide-react';
import { api } from '../../api/client';
import type { WorkspaceDetail } from '../../schemas/domain';
import { useWorkspaceUi } from '../../state/workspace-context';

type Props = {
  workspaceId: string;
  detail: WorkspaceDetail;
  onInspect: (id: string) => void;
  onChanged: () => Promise<void>;
};

export function EvidenceList({ workspaceId, detail, onInspect, onChanged }: Props) {
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
    <div className="list-heading"><div><span>ACCESSIBLE CANVAS ALTERNATIVE</span><h2 id="evidence-list-heading">Evidence List</h2></div><p>{rows.length} evidence items · {state.selectedEvidenceIds.length} selected</p></div>
    <div className="evidence-toolbar">
      <label><Search size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search evidence, source, cluster, opportunity…" /></label>
      <div><Filter size={13} /><button className={reviewFilter === 'all' ? 'active' : ''} onClick={() => setReviewFilter('all')}>All</button><button className={reviewFilter === 'proposed' ? 'active' : ''} onClick={() => setReviewFilter('proposed')}>Needs review</button><button className={reviewFilter === 'reviewed' ? 'active' : ''} onClick={() => setReviewFilter('reviewed')}>Reviewed</button><button className={contradictionsOnly ? 'active' : ''} onClick={() => setContradictionsOnly((current) => !current)}>Contradictions</button></div>
      <button className="bulk-review-button" disabled={bulkBusy || !state.selectedEvidenceIds.length} onClick={() => void markSelectedReviewed()}><Check size={13} />{bulkBusy ? 'Updating…' : 'Mark selected reviewed'}</button>
    </div>
    <div className="evidence-columns" aria-hidden="true"><span>Select</span><span>Evidence</span><span>Source</span><span>Cluster / state</span><span>Links</span></div>
    <div ref={parentRef} className="evidence-virtual-list" role="list" aria-label="Extracted evidence">
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
            <label className="row-select"><input type="checkbox" aria-label={`Select evidence: ${item.title}`} checked={selected} onChange={() => dispatch({ type: 'toggle-evidence', id: item.id })} /><span>{selected ? <Check size={13} /> : null}</span></label>
            <button className="row-main" onClick={() => onInspect(item.id)}><b>{item.title}</b><p>{item.body}</p></button>
            <div className="row-source"><b>{source?.name ?? 'Unknown source'}</b><span>{fragment?.locator ?? 'No locator'}</span>{source?.sensitive_warning ? <em><ShieldAlert size={12} /> sensitive</em> : null}</div>
            <div className="row-state"><b>{clusterMap.get(item.id) ?? 'Unclustered'}</b><span className={`review-chip state-${item.review_state}`}>{item.review_state}</span><small>{item.provider === 'human' ? 'Human' : `AI · ${item.model}`}</small></div>
            <div className="row-links">{contradictionIds.has(item.id) ? <span className="contradiction-chip">contradiction</span> : null}{opportunityTitles.slice(0, 2).map((title) => <span key={title}><Link2 size={11} />{title}</span>)}<button onClick={() => onInspect(item.id)} aria-label={`Inspect ${item.title}`}><ArrowUpRight size={15} /></button></div>
          </article>;
        })}
      </div>
    </div>
  </section>;
}
