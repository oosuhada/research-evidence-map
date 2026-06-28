import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Database, Play, Plus, Sprout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { LanguageToggle } from '../components/LanguageToggle';
import { ErrorState, LoadingState } from '../components/RouteState';
import { PortfolioNarrative } from '../components/PortfolioNarrative';
import { ResearchMemory } from '../features/memory/ResearchMemory';
import { useLocale, type Locale } from '../i18n/LocaleContext';
import type { WorkspaceSummary } from '../schemas/domain';

function guidedDemoSources(locale: Locale) {
  if (locale === 'ko') return [
    { name: '가상 인터뷰 · 프로덕트 매니저', source_type: 'interview', participant: '가상 PM', channel: '리서치 인터뷰', created_date: null, detected_encoding: 'utf-8', content: 'AI 요약이 하나 더 필요한 것이 아닙니다. 리뷰 회의에서 의사결정을 설명해야 하므로 중요한 주장마다 정확한 원문이 연결되어 있어야 합니다.' },
    { name: '가상 지원 문의 · 엔터프라이즈 승인', source_type: 'support', participant: '가상 엔터프라이즈 사용자', channel: '고객 지원', created_date: null, detected_encoding: 'utf-8', content: '승인 담당자는 각 문장이 원래 고객 기록으로 연결되고 서로 다른 의견까지 보존되지 않으면 AI가 만든 종합 결과를 받아들이지 않습니다.' },
    { name: '가상 앱 리뷰 · 파워 유저', source_type: 'app-review', participant: '가상 리뷰어', channel: '앱 리뷰', created_date: null, detected_encoding: 'utf-8', content: '하지만 항상 상세한 출처 정보를 펼쳐 놓으면 일상 업무가 느려집니다. 단순한 작업마다 전체 감사 이력을 보는 대신 필요할 때만 원문 링크를 열고 싶습니다.' },
    { name: '가상 리서치 노트 · 의사결정 맥락', source_type: 'meeting-note', participant: '가상 리서치 팀', channel: '리서치 노트', created_date: null, detected_encoding: 'utf-8', content: '팀에는 고객이 말한 모든 내용을 일반적으로 요약한 문서보다 이번 주에 내려야 할 의사결정 주변으로 근거가 정리되어 있는 것이 더 필요합니다.' },
  ];
  return [
    { name: 'Synthetic interview · Product manager', source_type: 'interview', participant: 'Synthetic PM', channel: 'Research interview', created_date: null, detected_encoding: 'utf-8', content: 'I do not need another AI summary. I need every important claim linked to the exact source because I have to defend the decision in a review meeting.' },
    { name: 'Synthetic support thread · Enterprise approval', source_type: 'support', participant: 'Synthetic enterprise user', channel: 'Support', created_date: null, detected_encoding: 'utf-8', content: 'Our approvers will not accept AI-generated synthesis unless each statement links back to the original customer record and preserves disagreement.' },
    { name: 'Synthetic app review · Power user', source_type: 'app-review', participant: 'Synthetic reviewer', channel: 'App review', created_date: null, detected_encoding: 'utf-8', content: 'However, detailed provenance slows routine work. I want source links on demand rather than opening a full audit trail for every simple task.' },
    { name: 'Synthetic research note · Decision context', source_type: 'meeting-note', participant: 'Synthetic research team', channel: 'Research note', created_date: null, detected_encoding: 'utf-8', content: 'The team needs evidence grouped around the decision they are making this week, not a generic summary of everything customers said.' },
  ];
}

const sampleResearchLibrary = [
  {
    name: 'Example · Trust & approval',
    description: 'How much provenance do teams need before they will act on AI-assisted research synthesis?',
    cluster: 'Control and provenance',
    opportunity: 'Progressive provenance for high-stakes review',
    opportunityBody: 'Keep routine synthesis lightweight, but make source fragments and disagreement one interaction away when approval stakes rise.',
    contradiction: 'Enterprise approvers want source detail visible during review, while a power user says always-visible provenance creates friction in routine work.',
    sources: guidedDemoSources('en'),
  },
  {
    name: 'Example · First-run comprehension',
    description: 'Why do new users abandon an analytical product before reaching its useful state?',
    cluster: 'First-run comprehension',
    opportunity: 'Turn the empty state into a guided working example',
    opportunityBody: 'Show a meaningful saved workspace immediately, then let the user inspect how it was produced instead of presenting an empty canvas.',
    sources: [
      { name: 'Synthetic usability session · Analyst', source_type: 'interview', participant: 'Synthetic analyst', channel: 'Usability study', created_date: null, detected_encoding: 'utf-8', content: 'I landed on the page and saw an empty workspace. I could tell it was powerful, but I did not know what a finished research project was supposed to look like.' },
      { name: 'Synthetic onboarding note · PM', source_type: 'meeting-note', participant: 'Synthetic PM', channel: 'Product review', created_date: null, detected_encoding: 'utf-8', content: 'A demo button helps, but asking people to create the demo before they understand the product still puts the explanation burden on the visitor.' },
      { name: 'Synthetic support thread · Research lead', source_type: 'support', participant: 'Synthetic research lead', channel: 'Support', created_date: null, detected_encoding: 'utf-8', content: 'Saved examples are useful because I can open a realistic project, inspect the evidence, then go back and create my own workspace with a mental model already formed.' },
    ],
  },
  {
    name: 'Example · Research handoff',
    description: 'What breaks when research moves from the researcher to product and engineering?',
    cluster: 'Control and provenance',
    opportunity: 'Preserve evidence context through the handoff',
    opportunityBody: 'Carry source, review state, contradictions, and opportunity rationale together so downstream teams can challenge rather than merely consume conclusions.',
    sources: [
      { name: 'Synthetic handoff interview · Designer', source_type: 'interview', participant: 'Synthetic designer', channel: 'Research interview', created_date: null, detected_encoding: 'utf-8', content: 'By the time a research finding reaches design, it is usually a sentence in a deck. I cannot see the customer language or whether another interview contradicted it.' },
      { name: 'Synthetic planning thread · Engineer', source_type: 'support', participant: 'Synthetic engineer', channel: 'Planning thread', created_date: null, detected_encoding: 'utf-8', content: 'I trust a product requirement more when I can inspect which evidence supports it and whether that evidence was accepted, edited, or still proposed.' },
      { name: 'Synthetic research ops note', source_type: 'meeting-note', participant: 'Synthetic research ops', channel: 'Research ops', created_date: null, detected_encoding: 'utf-8', content: 'Research memory should make repeated themes visible across studies without collapsing the original evidence into one permanent summary.' },
    ],
  },
] as const;

export function HomeRoute() {
  const navigate = useNavigate();
  const { locale, text, formatDate } = useLocale();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const bootstrappingSamples = useRef(false);

  const load = useCallback(async () => {
    const controller = new AbortController();
    setError(null);
    try { setWorkspaces(await api.listWorkspaces(controller.signal)); }
    catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : text('Could not load workspaces.', '워크스페이스를 불러오지 못했습니다.')); }
    return () => controller.abort();
  }, [text]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (workspaces === null || bootstrappingSamples.current) return;
    const existing = new Set(workspaces.map((workspace) => workspace.name));
    const missing = sampleResearchLibrary.filter((sample) => !existing.has(sample.name));
    if (!missing.length) return;
    bootstrappingSamples.current = true;
    void (async () => {
      try {
        for (const sample of missing) {
          const workspace = await api.createWorkspace(sample.name, sample.description);
          await api.commitImport(workspace.id, [...sample.sources], false);
          let detail = await api.getWorkspace(workspace.id);
          await api.analyze(workspace.id, detail.sources.map((source) => source.id));
          detail = await api.getWorkspace(workspace.id);
          await Promise.all(detail.evidence.map((evidence) => api.patchEvidence(evidence.id, { review_state: 'accepted' })));
          detail = await api.getWorkspace(workspace.id);
          const linked = detail.evidence.slice(0, Math.min(3, detail.evidence.length)).map((evidence) => evidence.id);
          if (linked.length) {
            await api.createCluster(workspace.id, sample.cluster, linked);
            const opportunity = await api.createOpportunity(workspace.id, sample.opportunity, sample.opportunityBody, linked);
            if ('contradiction' in sample && sample.contradiction && linked.length >= 3) {
              await api.addContradiction(workspace.id, sample.contradiction, [linked[1], linked[2]], opportunity.id);
              await api.challengeOpportunity(workspace.id, opportunity.id);
            }
          }
        }
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : text('Could not prepare the example research library.', '예시 리서치 라이브러리를 준비하지 못했습니다.'));
      } finally {
        bootstrappingSamples.current = false;
      }
    })();
  }, [load, text, workspaces]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setError(null);
    try {
      const workspace = await api.createWorkspace(name.trim(), description.trim());
      navigate(`/w/${workspace.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : text('Could not create workspace.', '워크스페이스를 만들지 못했습니다.')); }
    finally { setBusy(false); }
  };

  const createGuidedDemo = async () => {
    setDemoBusy(true);
    setError(null);
    try {
      const demoSources = guidedDemoSources(locale);
      const prior = await api.createWorkspace(
        text('Guided demo · Prior trust study', '가이드 데모 · 이전 신뢰 리서치'),
        text('Synthetic earlier study used to demonstrate recurring research memory across separate workspaces.', '서로 다른 워크스페이스에서 반복되는 Research Memory를 보여주기 위한 가상의 이전 리서치입니다.'),
      );
      await api.commitImport(prior.id, demoSources.slice(0, 2), false);
      let priorDetail = await api.getWorkspace(prior.id);
      await api.analyze(prior.id, priorDetail.sources.map((source) => source.id));
      priorDetail = await api.getWorkspace(prior.id);
      await Promise.all(priorDetail.evidence.map((evidence) => api.patchEvidence(evidence.id, { review_state: 'accepted' })));
      priorDetail = await api.getWorkspace(prior.id);
      if (priorDetail.evidence.length) await api.createCluster(prior.id, text('Traceable AI trust', '추적 가능한 AI 신뢰'), priorDetail.evidence.slice(0, 2).map((evidence) => evidence.id));

      const workspace = await api.createWorkspace(
        text('Guided demo · Evidence traceability', '가이드 데모 · 근거 추적'),
        text('Synthetic onboarding workspace showing the complete source → evidence → opportunity workflow.', 'source → evidence → opportunity 전체 흐름을 보여주는 가상 온보딩 워크스페이스입니다.'),
      );
      await api.commitImport(workspace.id, demoSources, false);
      let detail = await api.getWorkspace(workspace.id);
      await api.analyze(workspace.id, detail.sources.map((source) => source.id));
      detail = await api.getWorkspace(workspace.id);
      await Promise.all(detail.evidence.map((evidence) => api.patchEvidence(evidence.id, { review_state: 'accepted' })));
      detail = await api.getWorkspace(workspace.id);
      if (detail.evidence.length) await api.createCluster(workspace.id, text('Traceable AI trust', '추적 가능한 AI 신뢰'), detail.evidence.slice(0, 3).map((evidence) => evidence.id));
      const linkedEvidence = detail.evidence.slice(0, 3).map((evidence) => evidence.id);
      const opportunity = await api.createOpportunity(workspace.id,
        text('Make AI synthesis traceable without forcing audit detail into every task', '모든 작업에 감사 정보를 강제하지 않으면서 AI 종합 결과를 추적 가능하게 만들기'),
        text('Expose exact source provenance when confidence or approval requires it, while keeping routine workflows lightweight.', '신뢰 확인이나 승인이 필요한 순간에는 정확한 원문 출처를 열 수 있게 하되 일상 흐름은 가볍게 유지합니다.'),
        linkedEvidence,
      );
      if (detail.evidence.length >= 3) {
        await api.addContradiction(workspace.id, text(
          'Synthetic contradiction: enterprise approval needs detailed provenance, while a power user says always-visible provenance adds friction.',
          '가상 상충 근거: 엔터프라이즈 승인에는 상세한 출처가 필요하지만 파워 유저는 항상 노출되는 출처 정보가 오히려 마찰을 만든다고 말합니다.',
        ), [detail.evidence[1].id, detail.evidence[2].id], opportunity.id);
      }
      await api.challengeOpportunity(workspace.id, opportunity.id);
      navigate(`/w/${workspace.id}?view=list&tour=1`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text('Could not create guided demo.', '가이드 데모를 만들지 못했습니다.'));
    } finally {
      setDemoBusy(false);
    }
  };

  return <main className="garden-shell home-shell">
    <header className="masthead"><div className="journal-mark"><Sprout size={20} /><span>Research Evidence Map</span></div><div className="edition">{text('CUSTOMER RESEARCH WORKBENCH', '고객 리서치 워크벤치')}<br />{text('VERIFICATION-FIRST SYNTHESIS', '검증 우선 AI 종합')}</div><div className="masthead-tools"><div className="masthead-status"><i className="done" />{text('LOCAL-FIRST / TRACEABLE', 'LOCAL-FIRST / 추적 가능')}</div><LanguageToggle /></div></header>
    <section className="home-hero"><span className="portfolio-hero-thesis">RESEARCH EVIDENCE MAP · VERIFICATION-FIRST</span><span className="kicker">{text('REDUCE THE AI VERIFICATION TAX', 'AI VERIFICATION TAX 줄이기')}</span><h1>{locale === 'ko' ? <><span className="hero-copy-chunk">AI가 만든 인사이트를</span>{' '}<em><span className="hero-copy-chunk">추적하고 검증하고</span>{' '}<span className="hero-copy-chunk">설명할 수 있는 결정으로.</span></em></> : <>Turn AI-generated insight into decisions you can <em>trace, verify, and defend.</em></>}</h1><p>{text('Import interviews, reviews, support threads, and meeting notes. AI output stays a proposal until a human reviews the source, contradictions, and decision context.', '인터뷰, 리뷰, 고객지원 대화와 회의 노트를 가져오세요. AI 결과는 사람이 원문과 상충 근거, 의사결정 맥락을 검토하기 전까지 제안 상태로 남습니다.')}</p><div className="home-quickstart"><button type="button" className="ink-button" onClick={() => void createGuidedDemo()} disabled={demoBusy}><Play size={15} fill="currentColor" />{demoBusy ? text('Preparing guided demo…', '가이드 데모 준비 중…') : text('Try guided demo', '가이드 데모 체험')}</button><div><strong>{text('New here?', '처음이신가요?')}</strong><span>{text('Explore the saved sample research library below, or create a guided workspace through the real analysis flow.', '아래 저장된 예시 리서치 라이브러리를 살펴보거나 실제 분석 흐름으로 가이드 워크스페이스를 만들어보세요.')}</span></div></div></section>
    <section className="onboarding-strip" aria-label={text('How the product works', '제품 작동 방식')}><article><span>01</span><div><strong>{text('Import source material', '원문 자료 가져오기')}</strong><p>{text('Interviews, reviews, support threads, or notes become addressable source fragments.', '인터뷰, 리뷰, 고객지원 대화와 노트가 개별 추적 가능한 source fragment로 저장됩니다.')}</p></div></article><article><span>02</span><div><strong>{text('Verify the synthesis', 'AI 종합 결과 검증')}</strong><p>{text('AI output stays proposed until you accept, edit, reject, merge, or split it.', 'AI 결과는 사람이 승인·수정·거절하거나 묶고 나누기 전까지 제안 상태로 남습니다.')}</p></div></article><article><span>03</span><div><strong>{text('Record the decision', '사람의 결정 기록')}</strong><p>{text('Preserve contradictions and the evidence state that existed when the team chose to proceed, experiment, hold, or reject.', '팀이 진행·실험·보류·거절을 선택한 순간의 상충 근거와 검증 상태를 함께 보존합니다.')}</p></div></article></section>
    <PortfolioNarrative workspaceId={workspaces?.[0]?.id ?? null} />
    <ResearchMemory />
    <div className="home-grid">
      <form className="create-workspace" onSubmit={(event) => void create(event)}><div className="panel-heading"><div><span>{text('STEP 01 / RESEARCH QUESTION', 'STEP 01 / 리서치 질문')}</span><h2>{text('Create workspace', '워크스페이스 만들기')}</h2></div><Plus size={21} /></div><label>{text('Workspace name', '워크스페이스 이름')}<input value={name} onChange={(event) => setName(event.target.value)} placeholder={text('Q3 onboarding discovery', '3분기 온보딩 탐색')} autoFocus /></label><label>{text('Research question / description', '리서치 질문 / 설명')}<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={text('What are we trying to learn or decide?', '무엇을 배우거나 결정하려고 하나요?')} /></label><button className="ink-button" disabled={busy || !name.trim()}>{busy ? text('Creating…', '생성 중…') : text('Create workspace', '워크스페이스 만들기')}<ArrowRight size={16} /></button><small>{text('Local mode stores research in the configured database. AI analysis uses the deterministic reference adapter unless an external provider is explicitly configured.', 'Local mode에서는 리서치가 설정된 데이터베이스에 저장됩니다. 외부 AI provider를 별도로 설정하지 않으면 deterministic reference adapter를 사용합니다.')}</small></form>
      <section className="workspace-index"><div className="panel-heading"><div><span>{text('RESEARCH ARCHIVE', '리서치 아카이브')}</span><h2>{text('Saved research', '저장된 리서치')}</h2></div><Database size={20} /></div>{error ? <ErrorState detail={error} retry={() => void load()} /> : workspaces === null ? <LoadingState label={text('Reading saved research…', '저장된 리서치 불러오는 중…')} /> : workspaces.length === 0 ? <LoadingState label={text('Preparing example research library…', '예시 리서치 라이브러리 준비 중…')} /> : <div className="workspace-list">{workspaces.map((workspace, index) => <button key={workspace.id} onClick={() => navigate(`/w/${workspace.id}`)}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{workspace.name}</b><p>{workspace.description || text('No research description', '리서치 설명 없음')}</p><small>{workspace.name.startsWith('Example ·') ? text('SAVED EXAMPLE · ', '저장된 예시 · ') : ''}{formatDate(workspace.updated_at)}</small></div><ArrowRight size={16} /></button>)}</div>}</section>
    </div>
    <footer className="garden-footer"><span>{text('METHOD / HUMAN-REVIEWED SYNTHESIS + SOURCE PROVENANCE', 'METHOD / 사람의 검토 + 원문 근거 보존')}</span><span>POSTGRESQL · FASTAPI · REACT</span></footer>
  </main>;
}
