import { useEffect, useMemo, useState } from 'react';
import { BookOpenText, FileText, Save, Trash2, X } from 'lucide-react';
import { api } from '../../api/client';
import type { ReviewState, WorkspaceDetail } from '../../schemas/domain';
import { ProofMark } from '../../components/ProofMark';
import { useLocale } from '../../i18n/LocaleContext';

type Props = {
  detail: WorkspaceDetail;
  evidenceId: string;
  readOnly?: boolean;
  onClose: () => void;
  onChanged?: () => Promise<void> | void;
};

export function EvidenceInspector({ detail, evidenceId, readOnly = false, onClose, onChanged }: Props) {
  const { text } = useLocale();
  const evidence = detail.evidence.find((item) => item.id === evidenceId);
  const [title, setTitle] = useState(evidence?.title ?? '');
  const [body, setBody] = useState(evidence?.body ?? '');
  const [reviewState, setReviewState] = useState<ReviewState>(evidence?.review_state ?? 'proposed');
  const [clusterId, setClusterId] = useState(() => detail.clusters.find((item) => item.evidence_item_ids.includes(evidenceId) && item.review_state !== 'superseded')?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(evidence?.title ?? '');
    setBody(evidence?.body ?? '');
    setReviewState(evidence?.review_state ?? 'proposed');
    setClusterId(detail.clusters.find((item) => item.evidence_item_ids.includes(evidenceId) && item.review_state !== 'superseded')?.id ?? '');
  }, [detail.clusters, evidence, evidenceId]);

  const provenance = useMemo(() => (evidence?.source_fragment_ids ?? []).map((fragmentId) => {
    const fragment = detail.fragments.find((item) => item.id === fragmentId);
    const source = fragment ? detail.sources.find((item) => item.id === fragment.source_document_id) : undefined;
    return { fragment, source };
  }), [detail.fragments, detail.sources, evidence?.source_fragment_ids]);

  if (!evidence) return null;

  const save = async (excluded = evidence.excluded) => {
    setBusy(true); setError(null);
    try {
      const patch: Parameters<typeof api.patchEvidence>[1] = { review_state: reviewState, excluded, cluster_id: clusterId || null };
      if (title !== evidence.title) patch.title = title;
      if (body !== evidence.body) patch.body = body;
      await api.patchEvidence(evidence.id, patch);
      await onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text('Could not save evidence.', '근거를 저장하지 못했습니다.'));
    } finally { setBusy(false); }
  };

  return <aside className="evidence-ledger" aria-label={text('Evidence inspector', '근거 상세 보기')}>
    <button className="ledger-close" onClick={onClose} aria-label={text('Close evidence inspector', '근거 상세 보기 닫기')}><X size={17} /></button>
    <div className="ledger-heading"><BookOpenText size={18} /><span>{text('EVIDENCE LEDGER / SOURCE TRACE', '근거 원장 / 원문 추적')}</span></div>
    <div className="ledger-folio">{evidence.kind.toUpperCase()} · V{evidence.version}</div>
    {readOnly ? <h2>{evidence.title}</h2> : <input className="ledger-title-input" value={title} onChange={(event) => setTitle(event.target.value)} aria-label={text('Evidence title', '근거 제목')} />}
    {readOnly ? <p className="ledger-summary">{evidence.body}</p> : <textarea className="ledger-body-input" value={body} onChange={(event) => setBody(event.target.value)} rows={7} aria-label={text('Evidence excerpt', '근거 본문')} />}
    <div className="provenance-version"><b>{evidence.provider === 'human' ? text('Human-authored', '사람 작성') : `${evidence.provider} / ${evidence.model}`}</b><span>{evidence.prompt_version} · {evidence.schema_version} · {evidence.extraction_status}</span>{evidence.failure_reason ? <em>{evidence.failure_reason}</em> : null}</div>
    <div className="source-ledger-list">
      {provenance.map(({ fragment, source }, index) => <div className="source-trace" key={fragment?.id ?? index}><span>0{index + 1}</span><div><b>{source?.name ?? text('Missing source', '원문 없음')}</b><p>{fragment?.text ?? text('Source fragment unavailable', '원문 fragment를 사용할 수 없습니다')}</p><small>{fragment?.locator ?? text('No locator', '위치 정보 없음')}{source?.participant ? ` · ${source.participant}` : ''}</small></div><FileText size={14} /></div>)}
    </div>
    {!readOnly ? <div className="ledger-edit-controls">
      <label>{text('Review state', '검토 상태')}<select value={reviewState} onChange={(event) => setReviewState(event.target.value as ReviewState)}>{['proposed', 'reviewed', 'accepted', 'edited', 'rejected'].map((state) => <option key={state}>{state}</option>)}</select></label>
      <label>{text('Cluster', '클러스터')}<select value={clusterId} onChange={(event) => setClusterId(event.target.value)}><option value="">{text('Unclustered', '미분류')}</option>{detail.clusters.filter((item) => item.review_state !== 'superseded').map((cluster) => <option value={cluster.id} key={cluster.id}>{cluster.label}</option>)}</select></label>
      {error ? <p className="inline-error">{error}</p> : null}
      <button className="ink-button compact" onClick={() => void save()} disabled={busy}><Save size={14} />{busy ? text('Saving…', '저장 중…') : text('Save human edit', '사람의 수정 저장')}</button>
      <button className="danger-link" onClick={() => void save(!evidence.excluded)} disabled={busy}><Trash2 size={13} />{evidence.excluded ? text('Restore evidence', '근거 복원') : text('Exclude as incorrect evidence', '부정확한 근거로 제외')}</button>
    </div> : null}
    <ProofMark kind="underline" />
  </aside>;
}
