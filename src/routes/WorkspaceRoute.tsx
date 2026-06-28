import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, History, List, Map, Play, Redo2, ShieldCheck, Sprout, Undo2 } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { GardenCanvas } from '../canvas/GardenCanvas';
import { EmptyState, ErrorState, LoadingState } from '../components/RouteState';
import { WorkspaceGuide } from '../components/WorkspaceGuide';
import { ClusterControls } from '../features/clusters/ClusterControls';
import { EvidenceInspector } from '../features/evidence/EvidenceInspector';
import { EvidenceList } from '../features/evidence/EvidenceList';
import { ExportPanel } from '../features/exports/ExportPanel';
import { ResearchHealth } from '../features/health/ResearchHealth';
import { ResearchBrief } from '../features/brief/ResearchBrief';
import { ImportPanel } from '../features/imports/ImportPanel';
import { SourceRegister } from '../features/imports/SourceRegister';
import { OpportunityPanel } from '../features/opportunities/OpportunityPanel';
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
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Workspace could not be loaded.'); }
  }, [workspaceId]);
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
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Analysis failed.'); }
    finally { setBusy(null); }
  };

  const history = async (direction: 'undo' | 'redo') => {
    setBusy(direction); setError(null);
    try { await api[direction](workspaceId); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : `Nothing to ${direction}.`); }
    finally { setBusy(null); }
  };

  if (error && !detail) return <main className="garden-shell"><ErrorState detail={error} retry={() => void refresh()} /></main>;
  if (!detail) return <main className="garden-shell"><LoadingState /></main>;

  const latestRun = detail.analysis_runs[0];
  const activeClusters = detail.clusters.filter((item) => item.review_state !== 'superseded');
  const canUndo = detail.human_edits.some((item) => !item.undone);
  const canRedo = detail.human_edits.some((item) => item.undone);

  return <main className={`garden-shell workspace-shell ${lowPower ? 'low-power' : ''}`}>
    <header className="masthead"><div className="journal-mark"><Sprout size={20} /><span>Research Evidence Map</span></div><div className="edition">{detail.workspace.name.toUpperCase()}<br />CUSTOMER RESEARCH WORKBENCH</div><div className="masthead-status"><i className={latestRun?.status === 'succeeded' ? 'done' : ''} />{detail.workspace.mode.toUpperCase()}{lowPower ? ' · ECO' : ''}</div></header>
    <section className="workspace-hero"><div><Link to="/" className="back-link"><ArrowLeft size={13} />Research archive</Link><span className="kicker">WORKSPACE / {detail.workspace.id.slice(0, 8)}</span><h1>{detail.workspace.name}</h1><p>{detail.workspace.description || 'No research question has been recorded for this workspace yet.'}</p><button type="button" className="guide-trigger" onClick={() => { setGuideStep(0); setGuideOpen(true); }}>How to use this workspace</button></div><aside><div><ShieldCheck size={16} /><span>LOCAL REFERENCE MODE</span><p>Sources remain in the configured local database. Retention guidance: {detail.retention_days} days. Delete sources or the workspace whenever required.</p></div><div className="history-actions"><button onClick={() => void history('undo')} disabled={!canUndo || Boolean(busy)}><Undo2 size={14} />Undo</button><button onClick={() => void history('redo')} disabled={!canRedo || Boolean(busy)}><Redo2 size={14} />Redo</button></div></aside></section>

    {error ? <div className="page-error" role="alert">{error}<button onClick={() => setError(null)}>Dismiss</button></div> : null}

    <ResearchHealth detail={detail} />

    <nav className="workflow-rail" aria-label="Discovery workflow"><a href="#sources">01 Workspace</a><a href="#sources">02 Import</a><a href="#analysis">03 Analyze</a><a href="#evidence">04 Review & cluster</a><a href="#opportunities">05 Opportunity</a><a href="#opportunities">06 Challenge</a><a href="#brief">07 Brief</a><a href="#exports">08 Export</a></nav>

    <section id="sources"><ImportPanel workspaceId={workspaceId} onImported={setDetail} />{detail.sources.length ? <SourceRegister detail={detail} onDelete={(sourceId, sourceName) => { if (window.confirm(`Delete ${sourceName}? This also removes its source fragments.`)) void api.deleteSource(workspaceId, sourceId).then(refresh); }} /> : null}</section>

    <section id="analysis" className="analysis-console"><div><span>STEP 03 / ANALYSIS RUN</span><h2>Extract proposed evidence</h2><p>AI output is a proposal, never an accepted fact. It receives an extraction status and must enter the human review workflow.</p></div><div className="analysis-actions"><button className="ink-button compact" onClick={() => void analyze()} disabled={!detail.sources.length || busy === 'analysis'}><Play size={14} />{busy === 'analysis' ? 'Analyzing…' : `Analyze ${detail.sources.length} source${detail.sources.length === 1 ? '' : 's'}`}</button>{latestRun ? <small>{latestRun.status.toUpperCase()} · {latestRun.provider}/{latestRun.model}<br />{latestRun.prompt_version} · {latestRun.token_input + latestRun.token_output} tokens · ${latestRun.cost_usd.toFixed(4)}{latestRun.failure_reason ? ` · ${latestRun.failure_reason}` : ''}</small> : <small>No analysis run yet.</small>}</div></section>

    <section id="evidence" className="evidence-stage"><div className="map-index"><div><span>STEP 04 / EVIDENCE FIELD</span><b>{detail.evidence.filter((item) => !item.excluded).length} active evidence · {activeClusters.length} clusters</b></div><div className="view-switch" role="group" aria-label="Evidence view"><button className={state.view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={14} />Evidence List</button><button className={state.view === 'map' ? 'active' : ''} onClick={() => setView('map')}><Map size={14} />{mobile ? 'Focused Map' : 'Field Map'}</button></div></div>
      {!detail.evidence.length ? <EmptyState title="No extracted evidence yet." detail={detail.sources.length ? 'Run analysis after confirming the imported source scope.' : 'Import source documents before analysis.'} /> : state.view === 'list' ? <EvidenceList workspaceId={workspaceId} detail={detail} onInspect={inspectEvidence} onChanged={refresh} /> : <div className="map-frame production-map">{mobile ? <div className="focus-picker"><label>Focused cluster<select value={focusedClusterId ?? ''} onChange={(event) => updateSearch({ cluster: event.target.value || null })}>{activeClusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.label}</option>)}</select></label></div> : null}<GardenCanvas detail={detail} selectedEvidenceId={selectedEvidenceId} selectedOpportunityId={selectedOpportunityId} focusClusterId={focusedClusterId} focused={mobile} lowPower={lowPower} onEvidenceSelect={inspectEvidence} onOpportunitySelect={inspectOpportunity} onClearOpportunity={() => updateSearch({ opportunity: null })} /></div>}
    </section>

    {detail.evidence.length ? <ClusterControls workspaceId={workspaceId} detail={detail} onChanged={refresh} /> : null}
    {detail.evidence.length ? <ResearchBrief detail={detail} /> : null}
    <div id="opportunities"><OpportunityPanel workspaceId={workspaceId} detail={detail} selectedOpportunityId={selectedOpportunityId} onOpportunitySelect={inspectOpportunity} onChanged={refresh} /></div>
    <div id="exports"><ExportPanel workspaceId={workspaceId} detail={detail} onChanged={refresh} /></div>

    {selectedEvidenceId ? <EvidenceInspector detail={detail} evidenceId={selectedEvidenceId} onClose={() => updateSearch({ evidence: null })} onChanged={refresh} /> : null}
    {guideOpen ? <WorkspaceGuide step={guideStep} onStep={setGuideStep} onClose={() => setGuideOpen(false)} /> : null}
    <footer className="garden-footer"><span>METHOD / SOURCE → FRAGMENT → EVIDENCE → CLUSTER → OPPORTUNITY</span><span><History size={12} /> HUMAN EDITS ARE AUDITED + REVERSIBLE</span></footer>
  </main>;
}
