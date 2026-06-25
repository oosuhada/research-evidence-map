import { AlertTriangle, CheckCircle2, FileSearch, Link2, MessageSquareWarning } from 'lucide-react';
import type { WorkspaceDetail } from '../../schemas/domain';

type Props = {
  detail: WorkspaceDetail;
};

export function ResearchHealth({ detail }: Props) {
  const activeEvidence = detail.evidence.filter((item) => !item.excluded && item.review_state !== 'superseded');
  const reviewedEvidence = activeEvidence.filter((item) => ['reviewed', 'accepted', 'edited'].includes(item.review_state));
  const proposedEvidence = activeEvidence.filter((item) => item.review_state === 'proposed');
  const linkedSourceIds = new Set(
    activeEvidence.flatMap((item) => item.source_fragment_ids)
      .map((fragmentId) => detail.fragments.find((fragment) => fragment.id === fragmentId)?.source_document_id)
      .filter((sourceId): sourceId is string => Boolean(sourceId)),
  );
  const sourceCoverage = detail.sources.length === 0 ? 0 : Math.round((linkedSourceIds.size / detail.sources.length) * 100);
  const sensitiveSources = detail.sources.filter((item) => item.sensitive_warning).length;
  const activeOpportunities = detail.opportunities.filter((item) => item.review_state !== 'rejected' && item.review_state !== 'superseded');
  const weakOpportunities = activeOpportunities.filter((item) => item.evidence_item_ids.length < 2).length;
  const unresolvedContradictions = detail.contradictions.filter((item) => !['rejected', 'superseded'].includes(item.review_state)).length;

  const nextAction = detail.sources.length === 0
    ? 'Import at least two independent sources before synthesizing an opportunity.'
    : proposedEvidence.length > 0
      ? `Review ${proposedEvidence.length} proposed evidence item${proposedEvidence.length === 1 ? '' : 's'} before using them downstream.`
      : sourceCoverage < 100
        ? `${detail.sources.length - linkedSourceIds.size} source${detail.sources.length - linkedSourceIds.size === 1 ? '' : 's'} currently contribute no active evidence.`
        : weakOpportunities > 0
          ? `${weakOpportunities} opportunity ${weakOpportunities === 1 ? 'has' : 'have'} fewer than two supporting evidence items.`
          : unresolvedContradictions > 0
            ? `Inspect ${unresolvedContradictions} contradiction${unresolvedContradictions === 1 ? '' : 's'} before increasing commitment.`
            : 'The current evidence chain is reviewable end to end. Add disconfirming sources before treating the synthesis as stable.';

  return (
    <section className="research-health" aria-labelledby="research-health-heading">
      <div className="research-health-intro">
        <span>RESEARCH STATE</span>
        <h2 id="research-health-heading">What is supported, and what is still missing?</h2>
        <p>This is a coverage summary, not an AI confidence score. Counts come directly from imported sources, human review state, provenance links, and recorded contradictions.</p>
      </div>
      <div className="research-health-grid">
        <article><FileSearch size={16} /><span>SOURCE COVERAGE</span><strong>{sourceCoverage}%</strong><small>{linkedSourceIds.size}/{detail.sources.length} imported sources contribute active evidence</small></article>
        <article><CheckCircle2 size={16} /><span>HUMAN REVIEW</span><strong>{reviewedEvidence.length}/{activeEvidence.length}</strong><small>{proposedEvidence.length} proposed item{proposedEvidence.length === 1 ? '' : 's'} still awaiting review</small></article>
        <article><Link2 size={16} /><span>OPPORTUNITY SUPPORT</span><strong>{activeOpportunities.length - weakOpportunities}/{activeOpportunities.length}</strong><small>opportunities with at least two linked evidence items</small></article>
        <article><MessageSquareWarning size={16} /><span>COUNTER-EVIDENCE</span><strong>{unresolvedContradictions}</strong><small>recorded contradictions currently in scope</small></article>
      </div>
      <div className="research-next-action"><AlertTriangle size={15} /><div><span>NEXT EVIDENCE ACTION</span><p>{nextAction}</p>{sensitiveSources > 0 ? <small>{sensitiveSources} imported source{sensitiveSources === 1 ? '' : 's'} flagged as potentially sensitive.</small> : null}</div></div>
    </section>
  );
}
