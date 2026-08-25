import { useMemo, useState } from 'react';
import { CheckCircle2, GitCommitHorizontal, ShieldAlert } from 'lucide-react';
import { api } from '../../api/client';
import { useLocale } from '../../i18n/LocaleContext';
import type { DecisionOutcome, WorkspaceDetail } from '../../schemas/domain';

type Props = {
  workspaceId: string;
  detail: WorkspaceDetail;
  selectedOpportunityId: string | null;
  onChanged: () => Promise<void>;
};

const reviewedStates = new Set(['reviewed', 'accepted', 'edited']);

export function DecisionPanel({ workspaceId, detail, selectedOpportunityId, onChanged }: Props) {
  const { text, formatDate } = useLocale();
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
      setError(cause instanceof Error ? cause.message : text('Decision could not be recorded.', '의사결정을 기록하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return <section className="tool-panel decision-panel" aria-labelledby="decision-heading">
    <div className="panel-heading"><div><span>{text('STEP 07 / HUMAN DECISION', 'STEP 07 / 사람의 의사결정')}</span><h2 id="decision-heading">{text('Decision record', '의사결정 기록')}</h2></div><GitCommitHorizontal size={22} /></div>
    <p className="panel-intro">{text('Freeze what the team decided, why it decided it, and exactly which reviewed evidence, challenges, contradictions, and source fragments were visible at that moment.', '팀이 무엇을 왜 결정했는지, 그리고 그 순간 어떤 검토 완료 근거·반증 시도·상충 근거·원문 조각을 보고 있었는지 함께 보존합니다.')}</p>

    {!opportunity ? <div className="decision-empty"><ShieldAlert size={18} /><div><b>{text('Select an opportunity first.', '먼저 기회를 선택하세요.')}</b><p>{text('Choose an opportunity above so the decision can snapshot its current verification trail.', '위에서 기회를 선택하면 현재 검증 이력을 의사결정 시점 스냅샷으로 남길 수 있습니다.')}</p></div></div> : <>
      <div className="decision-gate" aria-label={text('Decision verification snapshot', '의사결정 검증 스냅샷')}>
        <div><span>{text('OPPORTUNITY', '기회')}</span><b>{opportunity.title}</b></div>
        <div><span>{text('HUMAN-REVIEWED', '사람 검토 완료')}</span><b>{reviewedCount}/{linkedEvidence.length}</b></div>
        <div><span>{text('CHALLENGES', '반증 시도')}</span><b>{opportunityChallenges.length}</b></div>
        <div><span>{text('CONTRADICTIONS', '상충 근거')}</span><b>{opportunityContradictions.length}</b></div>
      </div>

      {(reviewedCount < linkedEvidence.length || opportunityChallenges.length === 0) ? <div className="decision-warning"><ShieldAlert size={15} /><span>{reviewedCount < linkedEvidence.length ? text(`${linkedEvidence.length - reviewedCount} linked evidence item(s) still need human review. `, `연결된 근거 ${linkedEvidence.length - reviewedCount}개가 아직 사람의 검토를 기다리고 있습니다. `) : ''}{opportunityChallenges.length === 0 ? text('No challenge run has been recorded yet. ', '아직 반증 시도가 기록되지 않았습니다. ') : ''}{text('You can still record a decision; the unresolved state will be preserved in the snapshot.', '지금도 결정을 기록할 수 있으며 미해결 상태는 스냅샷에 그대로 보존됩니다.')}</span></div> : <div className="decision-ready"><CheckCircle2 size={15} /><span>{text('Current evidence has been human-reviewed and the opportunity has been challenged.', '현재 근거는 사람의 검토를 마쳤고 기회에 대한 반증 시도도 수행되었습니다.')}</span></div>}

      <form className="decision-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label>{text('Decision outcome', '의사결정 결과')}<select aria-label={text('Decision outcome', '의사결정 결과')} value={outcome} onChange={(event) => setOutcome(event.target.value as DecisionOutcome)}><option value="proceed">{text('Proceed', '진행')}</option><option value="experiment">{text('Run experiment', '실험 진행')}</option><option value="hold">{text('Hold', '보류')}</option><option value="reject">{text('Reject', '거절')}</option></select></label>
        <label>{text('Rationale', '판단 근거')}<textarea aria-label={text('Decision rationale', '의사결정 근거')} rows={4} value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder={text('What did the team decide, and which evidence or uncertainty mattered most?', '팀은 무엇을 결정했고 어떤 근거나 불확실성이 가장 중요했나요?')} /></label>
        <label>{text('Next step', '다음 단계')}<textarea aria-label={text('Decision next step', '의사결정 다음 단계')} rows={4} value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder={text('Prototype test, collect more evidence, ship, revisit on…', '프로토타입 테스트, 추가 근거 수집, 출시, 재검토 시점…')} /></label>
        <button className="ink-button compact" disabled={busy || !rationale.trim() || !linkedEvidence.length}>{busy ? text('Recording…', '기록 중…') : text('Record human decision', '사람의 의사결정 기록')}</button>
      </form>
      {error ? <div className="inline-error" role="alert">{error}</div> : null}

      <div className="decision-timeline" aria-label={text('Decision history', '의사결정 이력')}>
        {decisions.length ? decisions.map((decision) => <article key={decision.id}>
          <div className="decision-version"><span>v{decision.version}</span><b>{decision.outcome === 'proceed' ? text('Proceed', '진행') : decision.outcome === 'experiment' ? text('Run experiment', '실험 진행') : decision.outcome === 'hold' ? text('Hold', '보류') : text('Reject', '거절')}</b><time>{formatDate(decision.created_at)}</time></div>
          <p>{decision.rationale}</p>
          {decision.next_step ? <small><b>{text('Next:', '다음:')}</b> {decision.next_step}</small> : null}
          <div className="decision-proof"><span>{text(`${decision.reviewed_evidence_count}/${decision.evidence_item_ids.length} reviewed`, `${decision.reviewed_evidence_count}/${decision.evidence_item_ids.length} 검토 완료`)}</span><span>{text(`${decision.unresolved_evidence_count} unresolved`, `미해결 ${decision.unresolved_evidence_count}`)}</span><span>{text(`${decision.challenge_run_ids.length} challenge`, `반증 ${decision.challenge_run_ids.length}`)}</span><span>{text(`${decision.contradiction_ids.length} contradiction`, `상충 ${decision.contradiction_ids.length}`)}</span><span>{text(`${decision.source_fragment_ids.length} source fragments`, `원문 조각 ${decision.source_fragment_ids.length}`)}</span></div>
        </article>) : <p className="decision-history-empty">{text('No human decision has been recorded for this opportunity yet.', '이 기회에 대해 아직 사람의 의사결정이 기록되지 않았습니다.')}</p>}
      </div>
    </>}
  </section>;
}
