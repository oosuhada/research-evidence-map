import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { WorkspaceDetail } from '../../schemas/domain';

type Props = {
  detail: WorkspaceDetail;
  onDelete: (sourceId: string, sourceName: string) => void;
};

export function SourceRegister({ detail, onDelete }: Props) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: detail.sources.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 58,
    overscan: 6,
  });
  const height = Math.min(360, Math.max(76, detail.sources.length * 58));

  return <section className="source-register" aria-labelledby="source-register-heading">
    <div><b id="source-register-heading">{detail.sources.length} source document{detail.sources.length === 1 ? '' : 's'}</b><span>{detail.fragments.length} traceable fragments</span></div>
    <div className="source-virtual-list" ref={parentRef} role="list" aria-label="Imported source documents" style={{ height }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => {
          const source = detail.sources[row.index];
          return <article
            key={source.id}
            role="listitem"
            ref={virtualizer.measureElement}
            data-index={row.index}
            style={{ position: 'absolute', left: 0, top: 0, width: '100%', transform: `translateY(${row.start}px)` }}
          >
            <span>{source.source_type}</span><b>{source.name}</b><small>{source.participant || source.channel || 'No participant metadata'} · {source.detected_encoding}</small>
            <button onClick={() => onDelete(source.id, source.name)} aria-label={`Delete source ${source.name}`}>Delete</button>
          </article>;
        })}
      </div>
    </div>
  </section>;
}
