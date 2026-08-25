import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpenCheck, GitCompareArrows, Layers3, Search, Sparkles, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { ResearchMemory as ResearchMemoryData } from '../../schemas/domain';

const priorityLabel: Record<ResearchMemoryData['opportunities'][number]['priority_band'], string> = {
  'ready-for-decision-review': 'Ready for decision review',
  'finish-human-review': 'Finish human review',
  'collect-more-evidence': 'Collect more evidence',
  'challenge-before-prioritizing': 'Resolve counter-evidence',
};

const backlogLabel: Record<ResearchMemoryData['backlog'][number]['kind'], string> = {
  'research-question': 'Research question',
  'evidence-gap': 'Evidence gap',
  contradiction: 'Contradiction',
};

export function ResearchMemory() {
  const navigate = useNavigate();
  const [memory, setMemory] = useState<ResearchMemoryData | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.getResearchMemory('', controller.signal)
      .then(setMemory)
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Research memory could not be loaded.');
      });
    return () => controller.abort();
  }, []);

  const recurringThemes = useMemo(() => memory?.themes.filter((theme) => theme.status === 'recurring').slice(0, 8) ?? [], [memory]);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    setSearching(true);
    setError(null);
    try { setMemory(await api.getResearchMemory(query)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Cross-workspace search failed.'); }
    finally { setSearching(false); }
  };

  if (error && !memory) return <section className="research-memory memory-error"><TriangleAlert size={18} /><div><strong>Research memory unavailable</strong><p>{error}</p></div></section>;
  if (!memory) return <section className="research-memory memory-loading"><span>READING RESEARCH MEMORY…</span></section>;

  const latest = memory.latest_comparison;
  return <section className="research-memory" aria-labelledby="research-memory-heading">
    <div className="memory-heading">
      <div><span>RESEARCH OPERATIONS / MEMORY</span><h2 id="research-memory-heading">What keeps returning across research?</h2><p>This view compares saved workspaces using accepted source, evidence, cluster, opportunity, and contradiction state. It does not invent a confidence score.</p></div>
      <div className="memory-stats"><article><strong>{memory.workspace_count}</strong><span>workspaces</span></article><article><strong>{recurringThemes.length}</strong><span>recurring themes</span></article><article><strong>{memory.backlog.length}</strong><span>open research items</span></article></div>
    </div>

    <form className="memory-search" onSubmit={(event) => void search(event)}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search evidence, sources, themes, opportunities across every workspace" /><button type="submit" disabled={searching}>{searching ? 'Searching…' : 'Search memory'}</button></form>
    {query.trim() ? <div className="memory-search-results"><div className="memory-section-title"><span>CROSS-WORKSPACE SEARCH</span><b>{memory.search_results.length} matches</b></div>{memory.search_results.length ? memory.search_results.map((result) => <button key={`${result.kind}:${result.id}`} type="button" onClick={() => navigate(`/w/${result.workspace_id}${result.kind === 'evidence' ? `?view=list&evidence=${result.id}` : ''}`)}><em>{result.kind}</em><div><strong>{result.title}</strong><span>{result.workspace_name}</span><p>{result.excerpt}</p>{result.source_fragment_ids.length ? <small>{result.source_fragment_ids.length} source fragment link{result.source_fragment_ids.length === 1 ? '' : 's'} preserved</small> : null}</div><ArrowRight size={14} /></button>) : <p className="memory-empty">No stored research matches “{query.trim()}”.</p>}</div> : null}

    <div className="memory-grid">
      <article className="memory-panel latest-memory"><div className="memory-panel-head"><GitCompareArrows size={17} /><div><span>LATEST VS PREVIOUS</span><strong>{latest?.workspace_name ?? 'No research yet'}</strong></div></div>{latest ? <><div className="signal-split"><div><span>Recurring signals</span>{latest.recurring_signals.length ? latest.recurring_signals.map((label) => <button key={`repeat-${label}`} onClick={() => navigate(`/w/${latest.workspace_id}`)}><Layers3 size={12} />{label}</button>) : <p>No theme in the latest workspace has appeared in an earlier workspace yet.</p>}</div><div><span>New in latest research</span>{latest.new_signals.length ? latest.new_signals.map((label) => <button key={`new-${label}`} onClick={() => navigate(`/w/${latest.workspace_id}`)}><Sparkles size={12} />{label}</button>) : <p>No newly observed cluster in the latest workspace.</p>}</div></div><small>Compared with {latest.previous_workspace_count} earlier workspace{latest.previous_workspace_count === 1 ? '' : 's'}.</small></> : <p>Create and analyze a workspace to start accumulating research memory.</p>}</article>

      <article className="memory-panel"><div className="memory-panel-head"><Layers3 size={17} /><div><span>REPEATED THEMES</span><strong>Cross-workspace signals</strong></div></div><div className="theme-list">{recurringThemes.length ? recurringThemes.map((theme) => <div key={theme.key}><div><strong>{theme.label}</strong><span>{theme.workspace_names.join(' · ')}</span></div><b>{theme.workspace_count} workspaces<br />{theme.evidence_count} evidence</b></div>) : <p>No repeated cluster label has been observed across separate workspaces yet.</p>}</div></article>

      <article className="memory-panel backlog-panel"><div className="memory-panel-head"><TriangleAlert size={17} /><div><span>RESEARCH BACKLOG</span><strong>Unresolved questions & gaps</strong></div></div><div className="backlog-list">{memory.backlog.slice(0, 10).map((item) => <button key={item.id} onClick={() => navigate(`/w/${item.workspace_id}`)}><span>{backlogLabel[item.kind]}</span><strong>{item.label}</strong><p>{item.reason}</p><small>{item.workspace_name}</small></button>)}{memory.backlog.length === 0 ? <p>No current source coverage gaps or explicit contradictions were found.</p> : null}</div></article>

      <article className="memory-panel opportunity-priority"><div className="memory-panel-head"><BookOpenCheck size={17} /><div><span>OPPORTUNITY PRIORITIZATION</span><strong>Evidence state, not a score</strong></div></div><div className="priority-list">{memory.opportunities.slice(0, 10).map((item) => <button key={item.id} onClick={() => navigate(`/w/${item.workspace_id}?opportunity=${item.id}`)}><div><span>{priorityLabel[item.priority_band]}</span><strong>{item.title}</strong><small>{item.workspace_name}</small></div><p>{item.source_count} sources · {item.reviewed_evidence_count}/{item.linked_evidence_count} linked evidence reviewed · {item.contradiction_count} contradictions</p></button>)}{memory.opportunities.length === 0 ? <p>No active opportunities have been recorded yet.</p> : null}</div></article>
    </div>
  </section>;
}
