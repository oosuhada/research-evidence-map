import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUpRight, Check, Link2, ShieldAlert } from 'lucide-react';
import type { WorkspaceDetail } from '../../schemas/domain';
import { useWorkspaceUi } from '../../state/workspace-context';

type Props = {
  detail: WorkspaceDetail;
  onInspect: (id: string) => void;
};

export function EvidenceList({ detail, onInspect }: Props) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const { state, dispatch } = useWorkspaceUi();
  const rows = useMemo(() => detail.evidence.filter((item) => item.review_state !== 'superseded'), [detail.evidence]);
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
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 112, overscan: 8 });

  return <section className="evidence-workflow" aria-labelledby="evidence-list-heading">
    <div className="list-heading"><div><span>ACCESSIBLE CANVAS ALTERNATIVE</span><h2 id="evidence-list-heading">Evidence List</h2></div><p>{rows.length} evidence items · {state.selectedEvidenceIds.length} selected</p></div>
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
