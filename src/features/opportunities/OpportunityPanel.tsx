import { useState } from 'react';
import { Asterisk, Braces, Lightbulb, Link2 } from 'lucide-react';
import { api } from '../../api/client';
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
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Opportunity action failed.'); }
    finally { setBusy(false); }
  };

  const create = () => run(async () => {
    if (!title.trim() || !body.trim()) throw new Error('Add an opportunity title and hypothesis.');
    if (!state.selectedEvidenceIds.length) throw new Error('Select at least one evidence item first.');
    const opportunity = await api.createOpportunity(workspaceId, title.trim(), body.trim(), state.selectedEvidenceIds);
    setTitle(''); setBody(''); dispatch({ type: 'clear-evidence' }); onOpportunitySelect(opportunity.id);
  });

  const addContradiction = () => run(async () => {
    if (!contradiction.trim() || !state.selectedEvidenceIds.length) throw new Error('Select evidence and write what it contradicts.');
    await api.addContradiction(workspaceId, contradiction.trim(), state.selectedEvidenceIds, selectedOpportunity?.id);
    setContradiction('');
  });

  return <section className="tool-panel opportunity-panel" aria-labelledby="opportunity-heading">
    <div className="panel-heading"><div><span>STEP 05 / OPPORTUNITY</span><h2 id="opportunity-heading">Opportunity brief</h2></div><Lightbulb size={21} /></div>
    <form className="opportunity-form" onSubmit={(event) => { event.preventDefault(); void create(); }}><label>Opportunity title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Evidence-on-demand review flow" /></label><label>Hypothesis<textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder="If we…, then…, because the selected evidence shows…" /></label><button className="ink-button compact" disabled={busy || !state.selectedEvidenceIds.length}>Create from {state.selectedEvidenceIds.length} selected signal{state.selectedEvidenceIds.length === 1 ? '' : 's'}</button></form>
    <div className="opportunity-list">{detail.opportunities.length ? detail.opportunities.map((item) => <button key={item.id} className={item.id === selectedOpportunityId ? 'active' : ''} onClick={() => onOpportunitySelect(item.id)}><span>OPP</span><div><b>{item.title}</b><small>{item.evidence_item_ids.length} linked evidence · {item.review_state}</small></div><Link2 size={13} /></button>) : <p>No opportunity has been committed yet.</p>}</div>
    {selectedOpportunity ? <div className="challenge-note"><div className="challenge-title"><Asterisk size={16} /><b>Assumption challenge</b></div><p>{selectedOpportunity.body}</p><button disabled={busy} onClick={() => void run(() => api.challengeOpportunity(workspaceId, selectedOpportunity.id))}>Challenge this opportunity <Braces size={14} /></button>{latestChallenge ? <blockquote>{latestChallenge.response || latestChallenge.failure_reason}<small>{latestChallenge.provider} · {latestChallenge.model} · {latestChallenge.prompt_version}</small></blockquote> : <small>Challenge results remain versioned and source-linked.</small>}</div> : null}
    <div className="contradiction-form"><label>Contradiction note<textarea rows={3} value={contradiction} onChange={(event) => setContradiction(event.target.value)} placeholder="What does the selected evidence weaken or disagree with?" /></label><button className="outline-button" onClick={() => void addContradiction()} disabled={busy || !state.selectedEvidenceIds.length}>Add contradiction from selected evidence</button></div>
    {error ? <p className="inline-error" role="alert">{error}</p> : null}
  </section>;
}
