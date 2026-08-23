import { useCallback, useEffect, useState } from 'react';
import { Eye, List, Map, Sprout } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { GardenCanvas } from '../canvas/GardenCanvas';
import { ErrorState, LoadingState } from '../components/RouteState';
import { EvidenceInspector } from '../features/evidence/EvidenceInspector';
import type { WorkspaceDetail } from '../schemas/domain';

export function ShareRoute() {
  const { token = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const view = search.get('view') === 'list' ? 'list' : 'map';
  const evidenceId = search.get('evidence');
  const opportunityId = search.get('opportunity');
  const load = useCallback(async () => {
    const controller = new AbortController(); setError(null);
    try { setDetail(await api.getShare(token, controller.signal)); }
    catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Shared workspace could not be loaded.'); }
    return () => controller.abort();
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  const update = (key: string, value: string | null) => { const next = new URLSearchParams(search); if (value) next.set(key, value); else next.delete(key); setSearch(next, { replace: true }); };
  if (error) return <main className="garden-shell"><ErrorState title="This read-only field is unavailable." detail={error} /></main>;
  if (!detail) return <main className="garden-shell"><LoadingState label="Opening shared research field…" /></main>;
  return <main className="garden-shell share-shell"><header className="masthead"><div className="journal-mark"><Sprout size={20} /><span>Signal Garden</span></div><div className="edition">READ-ONLY RESEARCH FIELD<br />{detail.workspace.name.toUpperCase()}</div><div className="masthead-status"><Eye size={13} />SHARED / READ ONLY</div></header><section className="share-title"><span className="kicker">VERIFIABLE PRODUCT DISCOVERY</span><h1>{detail.workspace.name}</h1><p>{detail.workspace.description}</p><Link to="/">Open Signal Garden</Link></section><div className="map-index"><span>{detail.evidence.length} EVIDENCE · {detail.opportunities.length} OPPORTUNITIES</span><div className="view-switch"><button className={view === 'list' ? 'active' : ''} onClick={() => update('view', 'list')}><List size={14} />List</button><button className={view === 'map' ? 'active' : ''} onClick={() => update('view', 'map')}><Map size={14} />Map</button></div></div>{view === 'map' ? <div className="map-frame shared-map"><GardenCanvas detail={detail} selectedEvidenceId={evidenceId} selectedOpportunityId={opportunityId} onEvidenceSelect={(id) => update('evidence', id)} onOpportunitySelect={(id) => update('opportunity', id)} /></div> : <div className="readonly-list">{detail.evidence.filter((item) => !item.excluded).map((item) => <button key={item.id} onClick={() => update('evidence', item.id)}><span>{item.review_state}</span><b>{item.title}</b><p>{item.body}</p></button>)}</div>}{evidenceId ? <EvidenceInspector detail={detail} evidenceId={evidenceId} readOnly onClose={() => update('evidence', null)} /> : null}<footer className="garden-footer"><span>READ-ONLY LINK / SOURCE PROVENANCE PRESERVED</span><span>NO EDIT CONTROLS</span></footer></main>;
}
