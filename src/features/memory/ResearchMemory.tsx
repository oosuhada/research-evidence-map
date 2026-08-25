import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpenCheck, GitCompareArrows, Layers3, Search, Sparkles, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useLocale } from '../../i18n/LocaleContext';
import type { ResearchMemory as ResearchMemoryData } from '../../schemas/domain';

export function ResearchMemory() {
  const navigate = useNavigate();
  const { text } = useLocale();
  const [memory, setMemory] = useState<ResearchMemoryData | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.getResearchMemory('', controller.signal)
      .then(setMemory)
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : text('Research memory could not be loaded.', 'Research Memory를 불러오지 못했습니다.'));
      });
    return () => controller.abort();
  }, [text]);

  const recurringThemes = useMemo(() => memory?.themes.filter((theme) => theme.status === 'recurring').slice(0, 8) ?? [], [memory]);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    setSearching(true);
    setError(null);
    try { setMemory(await api.getResearchMemory(query)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : text('Cross-workspace search failed.', '워크스페이스 전체 검색에 실패했습니다.')); }
    finally { setSearching(false); }
  };

  if (error && !memory) return <section className="research-memory memory-error"><TriangleAlert size={18} /><div><strong>{text('Research memory unavailable', 'Research Memory를 사용할 수 없습니다')}</strong><p>{error}</p></div></section>;
  if (!memory) return <section className="research-memory memory-loading"><span>{text('READING RESEARCH MEMORY…', 'RESEARCH MEMORY 불러오는 중…')}</span></section>;

  const latest = memory.latest_comparison;
  const priorityLabel: Record<ResearchMemoryData['opportunities'][number]['priority_band'], string> = {
    'ready-for-decision-review': text('Ready for decision review', '의사결정 검토 준비 완료'),
    'finish-human-review': text('Finish human review', '사람의 검토 완료 필요'),
    'collect-more-evidence': text('Collect more evidence', '추가 근거 수집 필요'),
    'challenge-before-prioritizing': text('Resolve counter-evidence', '반대 근거 검토 필요'),
  };
  const backlogLabel: Record<ResearchMemoryData['backlog'][number]['kind'], string> = {
    'research-question': text('Research question', '리서치 질문'),
    'evidence-gap': text('Evidence gap', '근거 공백'),
    contradiction: text('Contradiction', '상충 근거'),
  };
  return <section className="research-memory" aria-labelledby="research-memory-heading">
    <div className="memory-heading">
      <div><span>{text('RESEARCH OPERATIONS / MEMORY', '리서치 운영 / 메모리')}</span><h2 id="research-memory-heading">{text('What keeps returning across research?', '리서치마다 반복해서 나타나는 신호는 무엇인가요?')}</h2><p>{text('This view compares saved workspaces using accepted source, evidence, cluster, opportunity, and contradiction state. It does not invent a confidence score.', '저장된 워크스페이스의 원문, 근거, 클러스터, 기회, 상충 상태를 비교합니다. 임의의 confidence score를 만들지 않습니다.')}</p></div>
      <div className="memory-stats"><article><strong>{memory.workspace_count}</strong><span>{text('workspaces', '워크스페이스')}</span></article><article><strong>{recurringThemes.length}</strong><span>{text('recurring themes', '반복 테마')}</span></article><article><strong>{memory.backlog.length}</strong><span>{text('open research items', '미해결 리서치')}</span></article></div>
    </div>

    <form className="memory-search" onSubmit={(event) => void search(event)}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text('Search evidence, sources, themes, opportunities across every workspace', '모든 워크스페이스의 근거·원문·테마·기회 검색')} /><button type="submit" disabled={searching}>{searching ? text('Searching…', '검색 중…') : text('Search memory', '메모리 검색')}</button></form>
    {query.trim() ? <div className="memory-search-results"><div className="memory-section-title"><span>{text('CROSS-WORKSPACE SEARCH', '워크스페이스 전체 검색')}</span><b>{text(`${memory.search_results.length} matches`, `${memory.search_results.length}개 일치`)}</b></div>{memory.search_results.length ? memory.search_results.map((result) => <button key={`${result.kind}:${result.id}`} type="button" onClick={() => navigate(`/w/${result.workspace_id}${result.kind === 'evidence' ? `?view=list&evidence=${result.id}` : ''}`)}><em>{result.kind}</em><div><strong>{result.title}</strong><span>{result.workspace_name}</span><p>{result.excerpt}</p>{result.source_fragment_ids.length ? <small>{text(`${result.source_fragment_ids.length} source fragment link${result.source_fragment_ids.length === 1 ? '' : 's'} preserved`, `원문 fragment 링크 ${result.source_fragment_ids.length}개 보존`)}</small> : null}</div><ArrowRight size={14} /></button>) : <p className="memory-empty">{text(`No stored research matches “${query.trim()}”.`, `“${query.trim()}”와 일치하는 저장 리서치가 없습니다.`)}</p>}</div> : null}

    <div className="memory-grid">
      <article className="memory-panel latest-memory"><div className="memory-panel-head"><GitCompareArrows size={17} /><div><span>{text('LATEST VS PREVIOUS', '최신 VS 이전')}</span><strong>{latest?.workspace_name ?? text('No research yet', '아직 리서치 없음')}</strong></div></div>{latest ? <><div className="signal-split"><div><span>{text('Recurring signals', '반복 신호')}</span>{latest.recurring_signals.length ? latest.recurring_signals.map((label) => <button key={`repeat-${label}`} onClick={() => navigate(`/w/${latest.workspace_id}`)}><Layers3 size={12} />{label}</button>) : <p>{text('No theme in the latest workspace has appeared in an earlier workspace yet.', '최신 워크스페이스의 테마 중 이전 워크스페이스에도 나타난 테마가 아직 없습니다.')}</p>}</div><div><span>{text('New in latest research', '최신 리서치의 새 신호')}</span>{latest.new_signals.length ? latest.new_signals.map((label) => <button key={`new-${label}`} onClick={() => navigate(`/w/${latest.workspace_id}`)}><Sparkles size={12} />{label}</button>) : <p>{text('No newly observed cluster in the latest workspace.', '최신 워크스페이스에서 새로 관찰된 클러스터가 없습니다.')}</p>}</div></div><small>{text(`Compared with ${latest.previous_workspace_count} earlier workspace${latest.previous_workspace_count === 1 ? '' : 's'}.`, `이전 워크스페이스 ${latest.previous_workspace_count}개와 비교했습니다.`)}</small></> : <p>{text('Create and analyze a workspace to start accumulating research memory.', '워크스페이스를 만들고 분석하면 Research Memory가 쌓이기 시작합니다.')}</p>}</article>

      <article className="memory-panel"><div className="memory-panel-head"><Layers3 size={17} /><div><span>{text('REPEATED THEMES', '반복 테마')}</span><strong>{text('Cross-workspace signals', '워크스페이스 간 신호')}</strong></div></div><div className="theme-list">{recurringThemes.length ? recurringThemes.map((theme) => <div key={theme.key}><div><strong>{theme.label}</strong><span>{theme.workspace_names.join(' · ')}</span></div><b>{text(`${theme.workspace_count} workspaces`, `워크스페이스 ${theme.workspace_count}개`)}<br />{text(`${theme.evidence_count} evidence`, `근거 ${theme.evidence_count}개`)}</b></div>) : <p>{text('No repeated cluster label has been observed across separate workspaces yet.', '서로 다른 워크스페이스에서 반복된 클러스터 이름이 아직 관찰되지 않았습니다.')}</p>}</div></article>

      <article className="memory-panel backlog-panel"><div className="memory-panel-head"><TriangleAlert size={17} /><div><span>{text('RESEARCH BACKLOG', '리서치 백로그')}</span><strong>{text('Unresolved questions & gaps', '미해결 질문 & 공백')}</strong></div></div><div className="backlog-list">{memory.backlog.slice(0, 10).map((item) => <button key={item.id} onClick={() => navigate(`/w/${item.workspace_id}`)}><span>{backlogLabel[item.kind]}</span><strong>{item.label}</strong><p>{item.reason}</p><small>{item.workspace_name}</small></button>)}{memory.backlog.length === 0 ? <p>{text('No current source coverage gaps or explicit contradictions were found.', '현재 원문 커버리지 공백이나 명시적인 상충 근거가 발견되지 않았습니다.')}</p> : null}</div></article>

      <article className="memory-panel opportunity-priority"><div className="memory-panel-head"><BookOpenCheck size={17} /><div><span>{text('OPPORTUNITY PRIORITIZATION', '기회 우선순위')}</span><strong>{text('Evidence state, not a score', '점수가 아니라 근거 상태')}</strong></div></div><div className="priority-list">{memory.opportunities.slice(0, 10).map((item) => <button key={item.id} onClick={() => navigate(`/w/${item.workspace_id}?opportunity=${item.id}`)}><div><span>{priorityLabel[item.priority_band]}</span><strong>{item.title}</strong><small>{item.workspace_name}</small></div><p>{text(`${item.source_count} sources · ${item.reviewed_evidence_count}/${item.linked_evidence_count} linked evidence reviewed · ${item.contradiction_count} contradictions`, `원문 ${item.source_count}개 · 연결 근거 ${item.reviewed_evidence_count}/${item.linked_evidence_count} 검토 완료 · 상충 ${item.contradiction_count}개`)}</p></button>)}{memory.opportunities.length === 0 ? <p>{text('No active opportunities have been recorded yet.', '아직 활성 기회가 기록되지 않았습니다.')}</p> : null}</div></article>
    </div>
  </section>;
}
