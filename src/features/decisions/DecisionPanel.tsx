import { useMemo, useState } from 'react';
import { CheckCircle2, GitCommitHorizontal, ShieldAlert } from 'lucide-react';
import { api } from '../../api/client';
import type { DecisionOutcome, WorkspaceDetail } from '../../schemas/domain';

type Props = {
  workspaceId: string;
  detail: WorkspaceDetail;
  selectedOpportunityId: string | null;
  onChanged: () => Promise<void>;
};

const outcomeLabels: Record<DecisionOutcome, string> = {
  proceed: 'Proceed',
  experiment: 'Run experiment',
  hold: 'Hold',
  reject: 'Reject',
};

const reviewedStates = new Set(['reviewed', 'accepted', 'edited']);

export function DecisionPanel({ workspaceId, detail, selectedOpportunityId, onChanged }: Props) {
  const [outcome, setOutcome] = useState<DecisionOutcome>('experiment');
  const [rationale, setRationale] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opportunity = detail.opportunities.find((item) => item.id === selectedOpportunityId) ?? null;
  const linkedEvidence = useMemo(() => {
    if (!opportunity) return [];
    const ids = new Set(opportunity.evidence_item_ids);
    return detail.evidence.filter((item) => ids.has(item.id) && !item.excluded && !['rejected', 'superseded'].includes(item.review_state));
  }, [detail.evidence, opportunity]);
  const reviewedCount = linkedEvidence.filter((item) => reviewedStates.has(item.review_state)).length;
  const opportunityChallenges = opportunity ? detail.challenges.filter((item) => item.opportunity_id === opportunity.id) : [];
  const opportunityContradictions = opportunity ? detail.contradictions.filter((item) => item.opportunity_id === opportunity.id) : [];
  const decisions = opportunity
    ? detail.decisions.filter((item) => item.opportunity_id === opportunity.id).sort((a, b) => b.version - a.version)
    : [];

  const submit = async () => {
    if (!opportunity || !rationale.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.recordDecision(workspaceId, opportunity.id, outcome, rationale.trim(), nextStep.trim());
      setRationale('');
      setNextStep('');
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Decision could not be recorded.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="tool-panel decision-panel" aria-labelledby="decision-heading">
    <div className="panel-heading"><div><span>STEP 07 / HUMAN DECISION</span><h2 id="decision-heading">Decision record</h2></div><GitCommitHorizontal size={22} /></div>
    <p className="panel-intro">Freeze what the team decided, why it decided it, and exactly which reviewed evidence, challenges, contradictions, and source fragments were visible at that moment.</p>

    {!opportunity ? <div className="decision-empty"><ShieldAlert size={18} /><div><b>Select an opportunity first.</b><p>Choose an opportunity above so the decision can snapshot its current verification trail.</p></div></div> : <>
      <div className="decision-gate" aria-label="Decision verification snapshot">
        <div><span>OPPORTUNITY</span><b>{opportunity.title}</b></div>
        <div><span>HUMAN-REVIEWED</span><b>{reviewedCount}/{linkedEvidence.length}</b></div>
        <div><span>CHALLENGES</span><b>{opportunityChallenges.length}</b></div>
        <div><span>CONTRADICTIONS</span><b>{opportunityContradictions.length}</b></div>
      </div>

      {(reviewedCount < linkedEvidence.length || opportunityChallenges.length === 0) ? <div className="decision-warning"><ShieldAlert size={15} /><span>{reviewedCount < linkedEvidence.length ? `${linkedEvidence.length - reviewedCount} linked evidence item(s) still need human review. ` : ''}{opportunityChallenges.length === 0 ? 'No challenge run has been recorded yet. ' : ''}You can still record a decision; the unresolved state will be preserved in the snapshot.</span></div> : <div className="decision-ready"><CheckCircle2 size={15} /><span>Current evidence has been human-reviewed and the opportunity has been challenged.</span></div>}

      <form className="decision-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label>Decision outcome<select aria-label="Decision outcome" value={outcome} onChange={(event) => setOutcome(event.target.value as DecisionOutcome)}><option value="proceed">Proceed</option><option value="experiment">Run experiment</option><option value="hold">Hold</option><option value="reject">Reject</option></select></label>
        <label>Rationale<textarea aria-label="Decision rationale" rows={4} value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="What did the team decide, and which evidence or uncertainty mattered most?" /></label>
        <label>Next step<textarea aria-label="Decision next step" rows={4} value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder="Prototype test, collect more evidence, ship, revisit on…" /></label>
        <button className="ink-button compact" disabled={busy || !rationale.trim() || !linkedEvidence.length}>{busy ? 'Recording…' : 'Record human decision'}</button>
      </form>
      {error ? <div className="inline-error" role="alert">{error}</div> : null}

      <div className="decision-timeline" aria-label="Decision history">
        {decisions.length ? decisions.map((decision) => <article key={decision.id}>
          <div className="decision-version"><span>v{decision.version}</span><b>{outcomeLabels[decision.outcome]}</b><time>{new Date(decision.created_at).toLocaleString()}</time></div>
          <p>{decision.rationale}</p>
          {decision.next_step ? <small><b>Next:</b> {decision.next_step}</small> : null}
          <div className="decision-proof"><span>{decision.reviewed_evidence_count}/{decision.evidence_item_ids.length} reviewed</span><span>{decision.unresolved_evidence_count} unresolved</span><span>{decision.challenge_run_ids.length} challenge</span><span>{decision.contradiction_ids.length} contradiction</span><span>{decision.source_fragment_ids.length} source fragments</span></div>
        </article>) : <p className="decision-history-empty">No human decision has been recorded for this opportunity yet.</p>}
      </div>
    </>}
  </section>;
}
