import { AlertTriangle, CheckCircle2, FileSearch, Link2, MessageSquareWarning } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext';
import type { WorkspaceDetail } from '../../schemas/domain';

type Props = {
  detail: WorkspaceDetail;
};

export function ResearchHealth({ detail }: Props) {
  const { text } = useLocale();
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
    ? text('Import at least two independent sources before synthesizing an opportunity.', '기회를 종합하기 전에 서로 독립적인 원문을 최소 두 개 가져오세요.')
    : proposedEvidence.length > 0
      ? text(`Review ${proposedEvidence.length} proposed evidence item${proposedEvidence.length === 1 ? '' : 's'} before using them downstream.`, `다음 단계에서 사용하기 전에 제안 상태의 근거 ${proposedEvidence.length}개를 검토하세요.`)
      : sourceCoverage < 100
        ? text(`${detail.sources.length - linkedSourceIds.size} source${detail.sources.length - linkedSourceIds.size === 1 ? '' : 's'} currently contribute no active evidence.`, `현재 활성 근거에 연결되지 않은 원문이 ${detail.sources.length - linkedSourceIds.size}개 있습니다.`)
        : weakOpportunities > 0
          ? text(`${weakOpportunities} opportunity ${weakOpportunities === 1 ? 'has' : 'have'} fewer than two supporting evidence items.`, `근거가 두 개 미만인 기회가 ${weakOpportunities}개 있습니다.`)
          : unresolvedContradictions > 0
            ? text(`Inspect ${unresolvedContradictions} contradiction${unresolvedContradictions === 1 ? '' : 's'} before increasing commitment.`, `결정의 확신을 높이기 전에 상충 근거 ${unresolvedContradictions}개를 검토하세요.`)
            : text('The current evidence chain is reviewable end to end. Add disconfirming sources before treating the synthesis as stable.', '현재 근거 체인은 처음부터 끝까지 검토 가능합니다. 종합 결과를 안정적인 결론으로 보기 전에 반증 가능한 원문을 더 추가하세요.');

  return (
    <section id="research-health" className="research-health" aria-labelledby="research-health-heading">
      <div className="research-health-intro">
        <span>{text('RESEARCH STATE', '리서치 상태')}</span>
        <h2 id="research-health-heading">{text('What is supported, and what is still missing?', '무엇이 근거로 뒷받침되고 무엇이 아직 비어 있나요?')}</h2>
        <p>{text('This is a coverage summary, not an AI confidence score. Counts come directly from imported sources, human review state, provenance links, and recorded contradictions.', '이 값은 AI confidence score가 아니라 근거 커버리지 요약입니다. 가져온 원문, 사람의 검토 상태, 출처 링크, 기록된 상충 근거에서 직접 계산됩니다.')}</p>
      </div>
      <div className="research-health-grid">
        <article><FileSearch size={16} /><span>{text('SOURCE COVERAGE', '원문 커버리지')}</span><strong>{sourceCoverage}%</strong><small>{text(`${linkedSourceIds.size}/${detail.sources.length} imported sources contribute active evidence`, `가져온 원문 ${detail.sources.length}개 중 ${linkedSourceIds.size}개가 활성 근거에 기여`)}</small></article>
        <article><CheckCircle2 size={16} /><span>{text('HUMAN REVIEW', '사람의 검토')}</span><strong>{reviewedEvidence.length}/{activeEvidence.length}</strong><small>{text(`${proposedEvidence.length} proposed item${proposedEvidence.length === 1 ? '' : 's'} still awaiting review`, `제안 상태 근거 ${proposedEvidence.length}개가 아직 검토 대기 중`)}</small></article>
        <article><Link2 size={16} /><span>{text('OPPORTUNITY SUPPORT', '기회 근거')}</span><strong>{activeOpportunities.length - weakOpportunities}/{activeOpportunities.length}</strong><small>{text('opportunities with at least two linked evidence items', '연결 근거가 두 개 이상인 기회')}</small></article>
        <article><MessageSquareWarning size={16} /><span>{text('COUNTER-EVIDENCE', '상충 근거')}</span><strong>{unresolvedContradictions}</strong><small>{text('recorded contradictions currently in scope', '현재 범위에 기록된 상충 근거')}</small></article>
      </div>
      <div className="research-next-action"><AlertTriangle size={15} /><div><span>{text('NEXT EVIDENCE ACTION', '다음 근거 액션')}</span><p>{nextAction}</p>{sensitiveSources > 0 ? <small>{text(`${sensitiveSources} imported source${sensitiveSources === 1 ? '' : 's'} flagged as potentially sensitive.`, `가져온 원문 ${sensitiveSources}개가 잠재적 민감정보로 표시되었습니다.`)}</small> : null}</div></div>
    </section>
  );
}
