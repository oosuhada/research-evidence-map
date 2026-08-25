import { useCallback, useEffect, useState } from 'react';
import { Eye, List, Map, Sprout } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { GardenCanvas } from '../canvas/GardenCanvas';
import { LanguageToggle } from '../components/LanguageToggle';
import { ErrorState, LoadingState } from '../components/RouteState';
import { EvidenceInspector } from '../features/evidence/EvidenceInspector';
import { useLocale } from '../i18n/LocaleContext';
import type { WorkspaceDetail } from '../schemas/domain';

export function ShareRoute() {
  const { text } = useLocale();
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
    catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : text('Shared workspace could not be loaded.', '공유 워크스페이스를 불러오지 못했습니다.')); }
    return () => controller.abort();
  }, [text, token]);
  useEffect(() => { void load(); }, [load]);
  const update = (key: string, value: string | null) => { const next = new URLSearchParams(search); if (value) next.set(key, value); else next.delete(key); setSearch(next, { replace: true }); };
  if (error) return <main className="garden-shell"><ErrorState title={text('This read-only field is unavailable.', '이 읽기 전용 화면을 사용할 수 없습니다.')} detail={error} /></main>;
  if (!detail) return <main className="garden-shell"><LoadingState label={text('Opening shared research field…', '공유 리서치 화면 여는 중…')} /></main>;
  return <main className="garden-shell share-shell"><header className="masthead"><div className="journal-mark"><Sprout size={20} /><span>Research Evidence Map</span></div><div className="edition">{text('READ-ONLY RESEARCH WORKSPACE', '읽기 전용 리서치 워크스페이스')}<br />{detail.workspace.name.toUpperCase()}</div><div className="masthead-tools"><div className="masthead-status"><Eye size={13} />{text('SHARED / READ ONLY', '공유됨 / 읽기 전용')}</div><LanguageToggle /></div></header><section className="share-title"><span className="kicker">{text('TRACEABLE PRODUCT RESEARCH', '추적 가능한 제품 리서치')}</span><h1>{detail.workspace.name}</h1><p>{detail.workspace.description}</p><Link to="/">{text('Open research workspace', '리서치 워크스페이스 열기')}</Link></section><div className="map-index"><span>{text(`${detail.evidence.length} EVIDENCE · ${detail.opportunities.length} OPPORTUNITIES`, `근거 ${detail.evidence.length}개 · 기회 ${detail.opportunities.length}개`)}</span><div className="view-switch"><button className={view === 'list' ? 'active' : ''} onClick={() => update('view', 'list')}><List size={14} />{text('List', '목록')}</button><button className={view === 'map' ? 'active' : ''} onClick={() => update('view', 'map')}><Map size={14} />{text('Map', '맵')}</button></div></div>{view === 'map' ? <div className="map-frame shared-map"><GardenCanvas detail={detail} selectedEvidenceId={evidenceId} selectedOpportunityId={opportunityId} onEvidenceSelect={(id) => update('evidence', id)} onOpportunitySelect={(id) => update('opportunity', id)} /></div> : <div className="readonly-list">{detail.evidence.filter((item) => !item.excluded).map((item) => <button key={item.id} onClick={() => update('evidence', item.id)}><span>{item.review_state}</span><b>{item.title}</b><p>{item.body}</p></button>)}</div>}{evidenceId ? <EvidenceInspector detail={detail} evidenceId={evidenceId} readOnly onClose={() => update('evidence', null)} /> : null}<footer className="garden-footer"><span>{text('READ-ONLY LINK / SOURCE PROVENANCE PRESERVED', '읽기 전용 링크 / 원문 출처 보존')}</span><span>{text('NO EDIT CONTROLS', '편집 기능 없음')}</span></footer></main>;
}
