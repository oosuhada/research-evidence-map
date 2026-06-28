import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, History, List, Map, Play, Redo2, ShieldCheck, Sprout, Undo2 } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { GardenCanvas } from '../canvas/GardenCanvas';
import { LanguageToggle } from '../components/LanguageToggle';
import { EmptyState, ErrorState, LoadingState } from '../components/RouteState';
import { WorkspaceGuide } from '../components/WorkspaceGuide';
import { ClusterControls } from '../features/clusters/ClusterControls';
import { DecisionPanel } from '../features/decisions/DecisionPanel';
import { EvidenceInspector } from '../features/evidence/EvidenceInspector';
import { EvidenceList } from '../features/evidence/EvidenceList';
import { ExportPanel } from '../features/exports/ExportPanel';
import { ResearchHealth } from '../features/health/ResearchHealth';
import { ResearchBrief } from '../features/brief/ResearchBrief';
import { ImportPanel } from '../features/imports/ImportPanel';
import { SourceRegister } from '../features/imports/SourceRegister';
import { OpportunityPanel } from '../features/opportunities/OpportunityPanel';
import { useLocale } from '../i18n/LocaleContext';
import type { WorkspaceDetail } from '../schemas/domain';
import { useWorkspaceUi, type WorkspaceView } from '../state/workspace-context';
import { WorkspaceUiProvider } from '../state/workspace-state';

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  useEffect(() => { const media = window.matchMedia(query); const listener = () => setMatches(media.matches); listener(); media.addEventListener('change', listener); return () => media.removeEventListener('change', listener); }, [query]);
  return matches;
}

export function WorkspaceRoute() {
  const [search] = useSearchParams();
  const mobile = useMedia('(max-width: 700px)');
  const requested = search.get('view');
  const initialView: WorkspaceView = requested === 'list' || requested === 'map' ? requested : mobile ? 'list' : 'map';
  return <WorkspaceUiProvider initialView={initialView}><WorkspaceRouteInner mobile={mobile} /></WorkspaceUiProvider>;
}

function WorkspaceRouteInner({ mobile }: { mobile: boolean }) {
  const { workspaceId = '' } = useParams();
  const { text } = useLocale();
  const [search, setSearch] = useSearchParams();
  const { state, dispatch } = useWorkspaceUi();
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(() => search.get('tour') === '1');
  const [guideStep, setGuideStep] = useState(0);
  const lowPower = useMemo(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    return (nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4) || Boolean(nav.deviceMemory && nav.deviceMemory <= 4);
  }, []);
  const selectedEvidenceId = search.get('evidence');
  const selectedOpportunityId = search.get('opportunity');
  const focusedClusterId = search.get('cluster') ?? detail?.clusters.find((item) => item.review_state !== 'superseded')?.id ?? null;

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setError(null);
    try { setDetail(await api.getWorkspace(workspaceId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : text('Workspace could not be loaded.', '워크스페이스를 불러오지 못했습니다.')); }
  }, [text, workspaceId]);
  useEffect(() => { void refresh(); }, [refresh]);

  const updateSearch = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearch(next, { replace: true });
  };
  const setView = (view: WorkspaceView) => { dispatch({ type: 'set-view', view }); updateSearch({ view }); };
  const inspectEvidence = (id: string) => updateSearch({ evidence: id });
  const inspectOpportunity = (id: string) => updateSearch({ opportunity: id });

  const analyze = async () => {
    if (!detail?.sources.length) return;
    setBusy('analysis'); setError(null);
    try { await api.analyze(workspaceId, detail.sources.map((item) => item.id)); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : text('Analysis failed.', '분석에 실패했습니다.')); }
    finally { setBusy(null); }
  };

  const history = async (direction: 'undo' | 'redo') => {
    setBusy(direction); setError(null);
    try { await api[direction](workspaceId); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : direction === 'undo' ? text('Nothing to undo.', '되돌릴 작업이 없습니다.') : text('Nothing to redo.', '다시 적용할 작업이 없습니다.')); }
    finally { setBusy(null); }
  };

  if (error && !detail) return <main className="garden-shell"><ErrorState detail={error} retry={() => void refresh()} /></main>;
  if (!detail) return <main className="garden-shell"><LoadingState /></main>;

  const latestRun = detail.analysis_runs[0];
  const activeClusters = detail.clusters.filter((item) => item.review_state !== 'superseded');
  const canUndo = detail.human_edits.some((item) => !item.undone);
  const canRedo = detail.human_edits.some((item) => item.undone);

  return <main className={`garden-shell workspace-shell ${lowPower ? 'low-power' : ''}`}>
    <header className="masthead"><div className="journal-mark"><Sprout size={20} /><span>Research Evidence Map</span></div><div className="edition">{detail.workspace.name.toUpperCase()}<br />{text('CUSTOMER RESEARCH WORKBENCH', '고객 리서치 워크벤치')}</div><div className="masthead-tools"><LanguageToggle /><div className="masthead-status"><i className={latestRun?.status === 'succeeded' ? 'done' : ''} />{detail.workspace.mode.toUpperCase()}{lowPower ? ' · ECO' : ''}</div></div></header>
    <section className="workspace-hero"><div><Link to="/" className="back-link"><ArrowLeft size={13} />{text('Research archive', '리서치 아카이브')}</Link><span className="kicker">WORKSPACE / {detail.workspace.id.slice(0, 8)}</span><h1>{detail.workspace.name}</h1><p>{detail.workspace.description || text('No research question has been recorded for this workspace yet.', '이 워크스페이스에 아직 리서치 질문이 기록되지 않았습니다.')}</p><button type="button" className="guide-trigger" onClick={() => { setGuideStep(0); setGuideOpen(true); }}>{text('How to use this workspace', '워크스페이스 사용 방법')}</button></div><aside><div><ShieldCheck size={16} /><span>{text('LOCAL REFERENCE MODE', 'LOCAL REFERENCE MODE')}</span><p>{text(`Sources remain in the configured local database. Retention guidance: ${detail.retention_days} days. Delete sources or the workspace whenever required.`, `원문은 설정된 로컬 데이터베이스에 유지됩니다. 보관 권장 기간은 ${detail.retention_days}일이며 필요할 때 원문 또는 워크스페이스를 삭제할 수 있습니다.`)}</p></div><div className="history-actions"><button onClick={() => void history('undo')} disabled={!canUndo || Boolean(busy)}><Undo2 size={14} />{text('Undo', '되돌리기')}</button><button onClick={() => void history('redo')} disabled={!canRedo || Boolean(busy)}><Redo2 size={14} />{text('Redo', '다시 적용')}</button></div></aside></section>

    {error ? <div className="page-error" role="alert">{error}<button onClick={() => setError(null)}>{text('Dismiss', '닫기')}</button></div> : null}

    <ResearchHealth detail={detail} />

    <nav className="workflow-rail" aria-label={text('Discovery workflow', '리서치 의사결정 흐름')}><a href="#sources">01 {text('Workspace', '워크스페이스')}</a><a href="#sources">02 {text('Import', '가져오기')}</a><a href="#analysis">03 {text('Analyze', '분석')}</a><a href="#evidence">04 {text('Review & cluster', '검토 & 클러스터')}</a><a href="#opportunities">05 {text('Opportunity', '기회')}</a><a href="#opportunities">06 {text('Challenge', '반증')}</a><a href="#decisions">07 {text('Decision', '결정')}</a><a href="#brief">08 {text('Brief', '브리프')}</a><a href="#exports">09 {text('Export', '내보내기')}</a></nav>

    <section id="sources"><ImportPanel workspaceId={workspaceId} onImported={setDetail} />{detail.sources.length ? <SourceRegister detail={detail} onDelete={(sourceId, sourceName) => { if (window.confirm(text(`Delete ${sourceName}? This also removes its source fragments.`, `${sourceName}을(를) 삭제할까요? 연결된 source fragment도 함께 삭제됩니다.`))) void api.deleteSource(workspaceId, sourceId).then(refresh); }} /> : null}</section>

    <section id="analysis" className="analysis-console"><div><span>{text('STEP 03 / ANALYSIS RUN', 'STEP 03 / AI 분석')}</span><h2>{text('Extract proposed evidence', 'AI가 근거 후보 추출')}</h2><p>{text('AI output is a proposal, never an accepted fact. It receives an extraction status and must enter the human review workflow.', 'AI 결과는 확정된 사실이 아니라 제안입니다. 추출 상태를 가진 채 사람의 검토 workflow로 들어갑니다.')}</p></div><div className="analysis-actions"><button className="ink-button compact" onClick={() => void analyze()} disabled={!detail.sources.length || busy === 'analysis'}><Play size={14} />{busy === 'analysis' ? text('Analyzing…', '분석 중…') : text(`Analyze ${detail.sources.length} source${detail.sources.length === 1 ? '' : 's'}`, `원문 ${detail.sources.length}개 분석`)}</button>{latestRun ? <small>{latestRun.status.toUpperCase()} · {latestRun.provider}/{latestRun.model}<br />{latestRun.prompt_version} · {latestRun.token_input + latestRun.token_output} tokens · ${latestRun.cost_usd.toFixed(4)}{latestRun.failure_reason ? ` · ${latestRun.failure_reason}` : ''}</small> : <small>{text('No analysis run yet.', '아직 실행된 분석이 없습니다.')}</small>}</div></section>

    <section id="evidence" className="evidence-stage"><div className="map-index"><div><span>{text('STEP 04 / EVIDENCE FIELD', 'STEP 04 / 근거 검토')}</span><b>{text(`${detail.evidence.filter((item) => !item.excluded).length} active evidence · ${activeClusters.length} clusters`, `활성 근거 ${detail.evidence.filter((item) => !item.excluded).length}개 · 클러스터 ${activeClusters.length}개`)}</b></div><div className="view-switch" role="group" aria-label={text('Evidence view', '근거 보기 방식')}><button className={state.view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={14} />{text('Evidence List', '근거 목록')}</button><button className={state.view === 'map' ? 'active' : ''} onClick={() => setView('map')}><Map size={14} />{mobile ? text('Focused Map', '집중 맵') : text('Field Map', '필드 맵')}</button></div></div>
      {!detail.evidence.length ? <EmptyState title={text('No extracted evidence yet.', '아직 추출된 근거가 없습니다.')} detail={detail.sources.length ? text('Run analysis after confirming the imported source scope.', '가져온 원문 범위를 확인한 뒤 분석을 실행하세요.') : text('Import source documents before analysis.', '분석 전에 원문 자료를 가져오세요.')} /> : state.view === 'list' ? <EvidenceList detail={detail} onInspect={inspectEvidence} onChanged={refresh} /> : <div className="map-frame production-map">{mobile ? <div className="focus-picker"><label>{text('Focused cluster', '집중 클러스터')}<select value={focusedClusterId ?? ''} onChange={(event) => updateSearch({ cluster: event.target.value || null })}>{activeClusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.label}</option>)}</select></label></div> : null}<GardenCanvas detail={detail} selectedEvidenceId={selectedEvidenceId} selectedOpportunityId={selectedOpportunityId} focusClusterId={focusedClusterId} focused={mobile} lowPower={lowPower} onEvidenceSelect={inspectEvidence} onOpportunitySelect={inspectOpportunity} onClearOpportunity={() => updateSearch({ opportunity: null })} /></div>}
    </section>

    {detail.evidence.length ? <ClusterControls workspaceId={workspaceId} detail={detail} onChanged={refresh} /> : null}
    <div id="opportunities"><OpportunityPanel workspaceId={workspaceId} detail={detail} selectedOpportunityId={selectedOpportunityId} onOpportunitySelect={inspectOpportunity} onChanged={refresh} /></div>
    <div id="decisions"><DecisionPanel workspaceId={workspaceId} detail={detail} selectedOpportunityId={selectedOpportunityId} onChanged={refresh} /></div>
    <div id="brief">{detail.evidence.length ? <ResearchBrief detail={detail} /> : null}</div>
    <div id="exports"><ExportPanel workspaceId={workspaceId} detail={detail} onChanged={refresh} /></div>

    {selectedEvidenceId ? <EvidenceInspector detail={detail} evidenceId={selectedEvidenceId} onClose={() => updateSearch({ evidence: null })} onChanged={refresh} /> : null}
    {guideOpen ? <WorkspaceGuide step={guideStep} onStep={setGuideStep} onClose={() => setGuideOpen(false)} /> : null}
    <footer className="garden-footer"><span>{text('METHOD / SOURCE → FRAGMENT → EVIDENCE → CLUSTER → OPPORTUNITY → HUMAN DECISION', 'METHOD / 원문 → 조각 → 근거 → 클러스터 → 기회 → 사람의 결정')}</span><span><History size={12} /> {text('HUMAN EDITS ARE AUDITED + REVERSIBLE', '사람의 수정은 기록되고 되돌릴 수 있습니다')}</span></footer>
  </main>;
}
