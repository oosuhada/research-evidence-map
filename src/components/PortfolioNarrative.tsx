import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Database, Server, Sparkles, UserCheck } from 'lucide-react';
import { api } from '../api/client';
import { useLocale } from '../i18n/LocaleContext';
import type { WorkspaceDetail } from '../schemas/domain';

type TraceStage = { code: string; title: string; body: string; meta: string };

function fallbackStages(ko: boolean): TraceStage[] {
  return [
    { code: '01 / SOURCE', title: ko ? '아직 저장된 추적 경로 없음' : 'No persisted trace yet', body: ko ? '가이드 데모를 만들거나 리서치를 가져오면 실제 원문에 연결된 추적 경로가 생성됩니다.' : 'Create the guided demo or import research to generate a real source-backed trace.', meta: ko ? '설명용 fallback' : 'Fallback explanation only' },
    { code: '02 / FRAGMENT', title: ko ? '개별 추적 가능한 원문 조각' : 'Addressable source fragment', body: ko ? '가져온 문서는 위치 정보와 문자 범위를 가진 정확한 fragment로 분리됩니다.' : 'Imported documents are split into exact fragments with locators and character ranges.', meta: ko ? '원문 사실은 독립적으로 추적 가능' : 'Source truth remains separately addressable' },
    { code: '03 / EVIDENCE', title: ko ? '사람이 검토한 근거' : 'Human-reviewed evidence', body: ko ? 'AI가 제안한 근거는 사람이 승인·수정·거절하기 전까지 제안 상태로 남습니다.' : 'AI-proposed evidence remains proposed until a human accepts, edits, or rejects it.', meta: ko ? '검토 상태가 저장됨' : 'Review state is persisted' },
    { code: '04 / OPPORTUNITY', title: ko ? '추적 가능한 기회' : 'Traceable opportunity', body: ko ? '기회는 자신을 뒷받침하는 근거 항목과 명시적 연결을 유지합니다.' : 'Opportunities keep explicit links to the evidence items that support them.', meta: ko ? '결론이 근거를 대체하지 않음' : 'Conclusion never replaces evidence' },
  ];
}

export function PortfolioNarrative({ workspaceId }: { workspaceId?: string | null }) {
  const { locale, text } = useLocale();
  const ko = locale === 'ko';
  const [activeTrace, setActiveTrace] = useState(3);
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);

  useEffect(() => {
    if (!workspaceId) { setDetail(null); return undefined; }
    const controller = new AbortController();
    void api.getWorkspace(workspaceId, controller.signal).then(setDetail).catch(() => setDetail(null));
    return () => controller.abort();
  }, [workspaceId]);

  const liveTrace = useMemo(() => {
    if (!detail) return null;
    const opportunity = detail.opportunities.find((item) => item.evidence_item_ids.length > 0) ?? detail.opportunities[0];
    const evidence = opportunity
      ? detail.evidence.find((item) => opportunity.evidence_item_ids.includes(item.id) && item.source_fragment_ids.length > 0)
      : detail.evidence.find((item) => item.source_fragment_ids.length > 0);
    const fragment = evidence ? detail.fragments.find((item) => item.id === evidence.source_fragment_ids[0]) : undefined;
    const source = fragment ? detail.sources.find((item) => item.id === fragment.source_document_id) : undefined;
    if (!opportunity || !evidence || !fragment || !source) return null;
    return { opportunity, evidence, fragment, source };
  }, [detail]);

  const stages: TraceStage[] = liveTrace ? [
    { code: '01 / SOURCE', title: liveTrace.source.name, body: liveTrace.fragment.text, meta: `${liveTrace.fragment.locator}${liveTrace.source.participant ? ` · ${liveTrace.source.participant}` : ''}` },
    { code: '02 / FRAGMENT', title: text(`Fragment ${liveTrace.fragment.ordinal + 1}`, `Fragment ${liveTrace.fragment.ordinal + 1}`), body: liveTrace.fragment.text, meta: text(`chars ${liveTrace.fragment.char_start}–${liveTrace.fragment.char_end} · persisted locator ${liveTrace.fragment.locator}`, `문자 ${liveTrace.fragment.char_start}–${liveTrace.fragment.char_end} · 저장된 위치 ${liveTrace.fragment.locator}`) },
    { code: '03 / EVIDENCE', title: liveTrace.evidence.title, body: liveTrace.evidence.body, meta: text(`${liveTrace.evidence.review_state.toUpperCase()} · ${liveTrace.evidence.provider}/${liveTrace.evidence.model} · ${liveTrace.evidence.source_fragment_ids.length} source fragment${liveTrace.evidence.source_fragment_ids.length === 1 ? '' : 's'}`, `${liveTrace.evidence.review_state.toUpperCase()} · ${liveTrace.evidence.provider}/${liveTrace.evidence.model} · 원문 fragment ${liveTrace.evidence.source_fragment_ids.length}개`) },
    { code: '04 / OPPORTUNITY', title: liveTrace.opportunity.title, body: liveTrace.opportunity.body, meta: text(`${liveTrace.opportunity.evidence_item_ids.length} linked evidence · ${liveTrace.opportunity.review_state.toUpperCase()}`, `연결 근거 ${liveTrace.opportunity.evidence_item_ids.length}개 · ${liveTrace.opportunity.review_state.toUpperCase()}`) },
  ] : fallbackStages(ko);
  const stage = stages[activeTrace];

  const story = [
    [text('BEFORE', '이전'), text('Research lived in documents, dashboards, and summaries that lost their source trail.', '리서치는 문서·대시보드·요약에 흩어져 있었고 원문으로 돌아가는 경로가 쉽게 사라졌습니다.')],
    [text('PROBLEM', '문제'), text('A polished synthesis is hard to trust when nobody can answer “who actually said this?”', '보기 좋은 종합 결과도 “실제로 누가 이렇게 말했는가?”에 답할 수 없으면 믿기 어렵습니다.')],
    [text('INSIGHT', '통찰'), text('Treat AI output as a proposal and preserve provenance as part of the domain model.', 'AI 결과를 사실이 아니라 제안으로 다루고 출처를 domain model의 일부로 보존합니다.')],
    [text('ARCHITECTURE', '구조'), text('Source → Fragment → Evidence → Cluster → Opportunity → Decision, with review state and history at every boundary.', 'Source → Fragment → Evidence → Cluster → Opportunity → Decision 흐름에서 경계마다 검토 상태와 이력을 남깁니다.')],
    [text('INTERACTION', '상호작용'), text('Trace a conclusion backward, challenge it, expose contradictions, and preserve the verification state behind a human decision.', '결론을 원문까지 거슬러 올라가고, 반증하고, 상충 근거를 드러내며, 사람의 결정 당시 검증 상태를 보존합니다.')],
    [text('RESULT', '결과'), text('The verification tax becomes visible and structured instead of being hidden in repeated manual checking.', '반복적인 수동 확인 속에 숨겨져 있던 verification tax를 보이게 만들고 구조화합니다.')],
  ];

  const liveWorkspaceHref = liveTrace && detail
    ? `/w/${detail.workspace.id}?view=list&opportunity=${liveTrace.opportunity.id}&evidence=${liveTrace.evidence.id}`
    : null;

  return (
    <section className="portfolio-narrative" aria-labelledby="portfolio-case-title">
      <div className="portfolio-thesis-row">
        <span>{text('RESEARCH EVIDENCE MAP / TRUST MODEL', 'RESEARCH EVIDENCE MAP / 신뢰 모델')}</span>
        <p>{text('AI may synthesize research. It should never erase the evidence needed to challenge that synthesis.', 'AI가 리서치를 종합할 수는 있어도, 그 종합을 반박하고 검증하는 데 필요한 근거까지 지워서는 안 됩니다.')}</p>
      </div>

      <div className="killer-demo">
        <div className="killer-copy">
          <span>{text('KILLER INTERACTION / TRACE ONE REAL CONCLUSION', '핵심 상호작용 / 한 결론을 원문까지 추적')}</span>
          <h2 id="portfolio-case-title">{text('Follow a persisted opportunity all the way back to the exact source sentence.', '저장된 기회에서 정확한 원문 문장까지 거슬러 올라가세요.')}</h2>
          <p>{liveTrace ? text('This trace is assembled from the latest persisted workspace returned by the real API—not a separate marketing formula.', '이 추적 경로는 마케팅용 가짜 데이터가 아니라 실제 API가 반환한 최신 저장 워크스페이스에서 구성됩니다.') : text('No traceable workspace is available yet. The guided demo will create one through the same API used by the product.', '아직 추적 가능한 워크스페이스가 없습니다. 가이드 데모가 제품과 같은 API를 통해 하나를 생성합니다.')}</p>
          {liveWorkspaceHref ? <a className="portfolio-live-link" href={liveWorkspaceHref}>{text('Open this trace in the workspace', '워크스페이스에서 이 추적 경로 열기')} <ArrowUpRight size={13} /></a> : null}
        </div>
        <div className="trace-demo" aria-label={text('Interactive provenance trace', '대화형 출처 추적')} data-proof={liveTrace ? 'persisted' : 'fallback'}>
          <div className="trace-rail">
            {stages.map((item, index) => (
              <button key={item.code} type="button" className={index === activeTrace ? 'active' : index < activeTrace ? 'passed' : ''} onClick={() => setActiveTrace(index)}>
                <span>{item.code}</span><i />
              </button>
            ))}
          </div>
          <article><span>{stage.code}</span><strong>{stage.title}</strong><p>{stage.body}</p><small>{stage.meta}</small></article>
        </div>
      </div>

      <details className="engineering-case">
        <summary><span>{text('ENGINEERING CASE STUDY', '엔지니어링 사례')}</span><b>{text('Problem → architecture → result', '문제 → 구조 → 결과')}</b></summary>
        <div className="engineering-case-body">
          <div className="approach-compare">
            <article className="common-approach"><span>{text('COMMON AI RESEARCH FLOW', '일반적인 AI 리서치 흐름')}</span><strong>{text('Documents → summary → recommendation', '문서 → 요약 → 추천')}</strong><p>{text('The conclusion is fast to produce, but provenance becomes an afterthought and disagreement is flattened.', '결론은 빨리 만들 수 있지만 출처는 부가정보가 되고 서로 다른 의견은 쉽게 납작해집니다.')}</p></article>
            <div className="compare-vs">VS</div>
            <article className="our-approach"><span>{text('THIS SYSTEM', '이 시스템')}</span><strong>{text('Source → fragment → reviewed evidence → opportunity → decision', '원문 → 조각 → 검토된 근거 → 기회 → 결정')}</strong><p>{text('Traceability, contradiction, review state, and decision-time snapshots remain first-class product behavior.', '추적 가능성, 상충 근거, 검토 상태, 의사결정 시점 스냅샷을 제품의 1급 데이터로 유지합니다.')}</p></article>
          </div>

          <div className="system-architecture" id="architecture">
            <header><span>{text('ARCHITECTURE / REAL TRUST + DATA FLOW', '아키텍처 / 실제 신뢰·데이터 흐름')}</span><h3>{text('AI is an adapter around a source-of-truth research domain.', 'AI는 source-of-truth 리서치 domain을 둘러싼 adapter입니다.')}</h3></header>
            <div className="architecture-lanes">
              <article><span>{text('INTERACTION', '상호작용')}</span><b>React workspace</b><small>{text('review · trace · cluster · opportunity · decision', '검토 · 추적 · 클러스터 · 기회 · 결정')}</small></article>
              <i>→</i>
              <article><Server size={15} /><span>DOMAIN API</span><b>FastAPI</b><small>{text('source / fragment / evidence / opportunity / decision contracts', 'source / fragment / evidence / opportunity / decision 계약')}</small></article>
              <i>→</i>
              <article><Database size={15} /><span>{text('SOURCE OF TRUTH', '기준 데이터')}</span><b>PostgreSQL</b><small>{text('provenance · review state · edit history', '출처 · 검토 상태 · 수정 이력')}</small></article>
              <article className="architecture-side"><Sparkles size={15} /><span>AI BOUNDARY</span><b>Provider adapter</b><small>{text('structured proposal only; never source truth', '구조화된 제안만 생성; 원문 사실이 아님')}</small></article>
              <article className="architecture-side human"><UserCheck size={15} /><span>HUMAN BOUNDARY</span><b>{text('Explicit review', '명시적 사람 검토')}</b><small>accept / edit / reject / challenge / undo</small></article>
            </div>
          </div>

          <div className="case-story">
            {story.map(([label, body], index) => <article key={label}><span>{String(index + 1).padStart(2, '0')} / {label}</span><p>{body}</p></article>)}
          </div>
        </div>
      </details>
    </section>
  );
}
