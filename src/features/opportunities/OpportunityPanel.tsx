import { useState } from 'react';
import { Asterisk, Braces, Lightbulb, Link2 } from 'lucide-react';
import { api } from '../../api/client';
import { useLocale } from '../../i18n/LocaleContext';
import type { WorkspaceDetail } from '../../schemas/domain';
import { useWorkspaceUi } from '../../state/workspace-context';

type Props = {
  workspaceId: string;
  detail: WorkspaceDetail;
  selectedOpportunityId?: string | null;
  onOpportunitySelect: (id: string) => void;
  onChanged: () => Promise<void>;
};

export function OpportunityPanel({ workspaceId, detail, selectedOpportunityId, onOpportunitySelect, onChanged }: Props) {
  const { text } = useLocale();
  const { state, dispatch } = useWorkspaceUi();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [contradiction, setContradiction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedOpportunity = detail.opportunities.find((item) => item.id === selectedOpportunityId) ?? null;
  const latestChallenge = selectedOpportunity ? [...detail.challenges].reverse().find((item) => item.opportunity_id === selectedOpportunity.id) : undefined;

  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await operation(); await onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : text('Opportunity action failed.', '기회 관련 작업에 실패했습니다.')); }
    finally { setBusy(false); }
  };

  const create = () => run(async () => {
    if (!title.trim() || !body.trim()) throw new Error(text('Add an opportunity title and hypothesis.', '기회 제목과 가설을 입력하세요.'));
    if (!state.selectedEvidenceIds.length) throw new Error(text('Select at least one evidence item first.', '먼저 근거를 하나 이상 선택하세요.'));
    const opportunity = await api.createOpportunity(workspaceId, title.trim(), body.trim(), state.selectedEvidenceIds);
    setTitle(''); setBody(''); dispatch({ type: 'clear-evidence' }); onOpportunitySelect(opportunity.id);
  });

  const addContradiction = () => run(async () => {
    if (!contradiction.trim() || !state.selectedEvidenceIds.length) throw new Error(text('Select evidence and write what it contradicts.', '근거를 선택하고 무엇과 상충하는지 작성하세요.'));
    await api.addContradiction(workspaceId, contradiction.trim(), state.selectedEvidenceIds, selectedOpportunity?.id);
    setContradiction('');
  });

  return <section className="tool-panel opportunity-panel" aria-labelledby="opportunity-heading">
    <div className="panel-heading"><div><span>{text('STEP 05 / OPPORTUNITY', 'STEP 05 / 기회')}</span><h2 id="opportunity-heading">{text('Opportunity brief', '기회 가설')}</h2></div><Lightbulb size={21} /></div>
    <form className="opportunity-form" onSubmit={(event) => { event.preventDefault(); void create(); }}><label>{text('Opportunity title', '기회 제목')}<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={text('Evidence-on-demand review flow', '필요할 때 근거를 확인하는 검토 흐름')} /></label><label>{text('Hypothesis', '가설')}<textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder={text('If we…, then…, because the selected evidence shows…', '우리가 …하면 …할 것이다. 선택한 근거가 …을 보여주기 때문이다.')} /></label><button className="ink-button compact" disabled={busy || !state.selectedEvidenceIds.length}>{text(`Create from ${state.selectedEvidenceIds.length} selected signal${state.selectedEvidenceIds.length === 1 ? '' : 's'}`, `선택한 근거 ${state.selectedEvidenceIds.length}개로 생성`)}</button></form>
    <div className="opportunity-list">{detail.opportunities.length ? detail.opportunities.map((item) => <button key={item.id} className={item.id === selectedOpportunityId ? 'active' : ''} onClick={() => onOpportunitySelect(item.id)}><span>OPP</span><div><b>{item.title}</b><small>{text(`${item.evidence_item_ids.length} linked evidence · ${item.review_state}`, `연결 근거 ${item.evidence_item_ids.length}개 · ${item.review_state}`)}</small></div><Link2 size={13} /></button>) : <p>{text('No opportunity has been committed yet.', '아직 기록된 기회가 없습니다.')}</p>}</div>
    {selectedOpportunity ? <div className="challenge-note"><div className="challenge-title"><Asterisk size={16} /><b>{text('Assumption challenge', '가설 반증')}</b></div><p>{selectedOpportunity.body}</p><button disabled={busy} onClick={() => void run(() => api.challengeOpportunity(workspaceId, selectedOpportunity.id))}>{text('Challenge this opportunity', '이 기회를 반증해보기')} <Braces size={14} /></button>{latestChallenge ? <blockquote>{latestChallenge.response || latestChallenge.failure_reason}<small>{latestChallenge.provider} · {latestChallenge.model} · {latestChallenge.prompt_version}</small></blockquote> : <small>{text('Challenge results remain versioned and source-linked.', '반증 결과는 버전과 원문 링크를 유지한 채 저장됩니다.')}</small>}</div> : null}
    <div className="contradiction-form"><label>{text('Contradiction note', '상충 근거 메모')}<textarea rows={3} value={contradiction} onChange={(event) => setContradiction(event.target.value)} placeholder={text('What does the selected evidence weaken or disagree with?', '선택한 근거는 어떤 주장이나 가설을 약화하거나 반박하나요?')} /></label><button className="outline-button" onClick={() => void addContradiction()} disabled={busy || !state.selectedEvidenceIds.length}>{text('Add contradiction from selected evidence', '선택한 근거로 상충 기록 추가')}</button></div>
    {error ? <p className="inline-error" role="alert">{error}</p> : null}
  </section>;
}
