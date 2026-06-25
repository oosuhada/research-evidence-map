import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Database, Plus, Sprout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/RouteState';
import type { WorkspaceSummary } from '../schemas/domain';

export function HomeRoute() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const controller = new AbortController();
    setError(null);
    try { setWorkspaces(await api.listWorkspaces(controller.signal)); }
    catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Could not load workspaces.'); }
    return () => controller.abort();
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setError(null);
    try {
      const workspace = await api.createWorkspace(name.trim(), description.trim());
      navigate(`/w/${workspace.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create workspace.'); }
    finally { setBusy(false); }
  };

  return <main className="garden-shell home-shell">
    <header className="masthead"><div className="journal-mark"><Sprout size={20} /><span>Signal Garden</span></div><div className="edition">AI PRODUCT DISCOVERY CANVAS<br />PRODUCTION RESEARCH EDITION · 2026</div><div className="masthead-status"><i className="done" />LOCAL-FIRST / TRACEABLE</div></header>
    <section className="home-hero"><span className="kicker">CUSTOMER EVIDENCE / OPPORTUNITY CARTOGRAPHY</span><h1>Turn scattered customer signals into <em>evidence-backed product opportunities.</em></h1><p>Import actual interviews, reviews, support threads, and meeting notes. Every synthesis remains reviewable, editable, reversible, and traceable to a source fragment.</p></section>
    <div className="home-grid">
      <form className="create-workspace" onSubmit={(event) => void create(event)}><div className="panel-heading"><div><span>STEP 01 / FIELD NOTE</span><h2>Create workspace</h2></div><Plus size={21} /></div><label>Workspace name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Q3 onboarding discovery" autoFocus /></label><label>Research question / description<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are we trying to learn or decide?" /></label><button className="ink-button" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Open a new field'}<ArrowRight size={16} /></button><small>Local/demo mode stores research in the configured local database. AI analysis is deterministic unless a provider adapter is explicitly configured.</small></form>
      <section className="workspace-index"><div className="panel-heading"><div><span>FIELD ARCHIVE</span><h2>Recent workspaces</h2></div><Database size={20} /></div>{error ? <ErrorState detail={error} retry={() => void load()} /> : workspaces === null ? <LoadingState label="Reading the field archive…" /> : workspaces.length === 0 ? <EmptyState title="No saved workspaces yet." detail="Create one to start importing source material." /> : <div className="workspace-list">{workspaces.map((workspace, index) => <button key={workspace.id} onClick={() => navigate(`/w/${workspace.id}`)}><span>0{index + 1}</span><div><b>{workspace.name}</b><p>{workspace.description || 'No research description'}</p><small>{new Date(workspace.updated_at).toLocaleString()}</small></div><ArrowRight size={16} /></button>)}</div>}</section>
    </div>
    <footer className="garden-footer"><span>METHOD / HUMAN-REVIEWED SYNTHESIS + SOURCE PROVENANCE</span><span>POSTGRESQL · FASTAPI · REACT</span></footer>
  </main>;
}
