import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Database, Play, Plus, Sprout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/RouteState';
import { ResearchMemory } from '../features/memory/ResearchMemory';
import type { WorkspaceSummary } from '../schemas/domain';

const guidedDemoSources = [
  { name: 'Synthetic interview · Product manager', source_type: 'interview', participant: 'Synthetic PM', channel: 'Research interview', created_date: null, detected_encoding: 'utf-8', content: 'I do not need another AI summary. I need every important claim linked to the exact source because I have to defend the decision in a review meeting.' },
  { name: 'Synthetic support thread · Enterprise approval', source_type: 'support', participant: 'Synthetic enterprise user', channel: 'Support', created_date: null, detected_encoding: 'utf-8', content: 'Our approvers will not accept AI-generated synthesis unless each statement links back to the original customer record and preserves disagreement.' },
  { name: 'Synthetic app review · Power user', source_type: 'app-review', participant: 'Synthetic reviewer', channel: 'App review', created_date: null, detected_encoding: 'utf-8', content: 'However, detailed provenance slows routine work. I want source links on demand rather than opening a full audit trail for every simple task.' },
  { name: 'Synthetic research note · Decision context', source_type: 'meeting-note', participant: 'Synthetic research team', channel: 'Research note', created_date: null, detected_encoding: 'utf-8', content: 'The team needs evidence grouped around the decision they are making this week, not a generic summary of everything customers said.' },
];

export function HomeRoute() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

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

  const createGuidedDemo = async () => {
    setDemoBusy(true);
    setError(null);
    try {
      const workspace = await api.createWorkspace('Guided demo · Evidence traceability', 'Synthetic onboarding workspace showing the complete source → evidence → opportunity workflow.');
      await api.commitImport(workspace.id, guidedDemoSources, false);
      let detail = await api.getWorkspace(workspace.id);
      await api.analyze(workspace.id, detail.sources.map((source) => source.id));
      detail = await api.getWorkspace(workspace.id);
      await Promise.all(detail.evidence.map((evidence) => api.patchEvidence(evidence.id, { review_state: 'accepted' })));
      detail = await api.getWorkspace(workspace.id);
      const linkedEvidence = detail.evidence.slice(0, 3).map((evidence) => evidence.id);
      const opportunity = await api.createOpportunity(workspace.id, 'Make AI synthesis traceable without forcing audit detail into every task', 'Expose exact source provenance when confidence or approval requires it, while keeping routine workflows lightweight.', linkedEvidence);
      if (detail.evidence.length >= 3) {
        await api.addContradiction(workspace.id, 'Synthetic contradiction: enterprise approval needs detailed provenance, while a power user says always-visible provenance adds friction.', [detail.evidence[1].id, detail.evidence[2].id], opportunity.id);
      }
      await api.challengeOpportunity(workspace.id, opportunity.id);
      navigate(`/w/${workspace.id}?view=list&tour=1`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create guided demo.');
    } finally {
      setDemoBusy(false);
    }
  };

  return <main className="garden-shell home-shell">
    <header className="masthead"><div className="journal-mark"><Sprout size={20} /><span>Research Evidence Map</span></div><div className="edition">CUSTOMER RESEARCH WORKBENCH<br />SOURCE-TRACEABLE SYNTHESIS</div><div className="masthead-status"><i className="done" />LOCAL-FIRST / TRACEABLE</div></header>
    <section className="home-hero"><span className="kicker">RESEARCH EVIDENCE / SOURCE TRACEABILITY</span><h1>Turn scattered customer research into <em>evidence you can inspect.</em></h1><p>Import interviews, reviews, support threads, and meeting notes. Every synthesis remains reviewable, editable, reversible, and traceable to an exact source fragment.</p><div className="home-quickstart"><button type="button" className="ink-button" onClick={() => void createGuidedDemo()} disabled={demoBusy}><Play size={15} fill="currentColor" />{demoBusy ? 'Preparing guided demo…' : 'Try guided demo'}</button><div><strong>New here?</strong><span>Creates a synthetic workspace, runs the real analysis flow, and opens a 4-step walkthrough.</span></div></div></section>
    <section className="onboarding-strip" aria-label="How the product works"><article><span>01</span><div><strong>Import source material</strong><p>Interviews, reviews, support threads, or notes enter as source documents and exact fragments.</p></div></article><article><span>02</span><div><strong>Review the synthesis</strong><p>AI output stays proposed until you accept, edit, reject, merge, or split it.</p></div></article><article><span>03</span><div><strong>Act on the evidence</strong><p>Derive opportunities, inspect research gaps, challenge assumptions, then export or share.</p></div></article></section>
    <ResearchMemory />
    <div className="home-grid">
      <form className="create-workspace" onSubmit={(event) => void create(event)}><div className="panel-heading"><div><span>STEP 01 / RESEARCH QUESTION</span><h2>Create workspace</h2></div><Plus size={21} /></div><label>Workspace name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Q3 onboarding discovery" autoFocus /></label><label>Research question / description<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are we trying to learn or decide?" /></label><button className="ink-button" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create workspace'}<ArrowRight size={16} /></button><small>Local mode stores research in the configured database. AI analysis uses the deterministic reference adapter unless an external provider is explicitly configured.</small></form>
      <section className="workspace-index"><div className="panel-heading"><div><span>RESEARCH ARCHIVE</span><h2>Recent workspaces</h2></div><Database size={20} /></div>{error ? <ErrorState detail={error} retry={() => void load()} /> : workspaces === null ? <LoadingState label="Reading saved research…" /> : workspaces.length === 0 ? <EmptyState title="No saved workspaces yet." detail="Create one to start importing source material." /> : <div className="workspace-list">{workspaces.map((workspace, index) => <button key={workspace.id} onClick={() => navigate(`/w/${workspace.id}`)}><span>0{index + 1}</span><div><b>{workspace.name}</b><p>{workspace.description || 'No research description'}</p><small>{new Date(workspace.updated_at).toLocaleString()}</small></div><ArrowRight size={16} /></button>)}</div>}</section>
    </div>
    <footer className="garden-footer"><span>METHOD / HUMAN-REVIEWED SYNTHESIS + SOURCE PROVENANCE</span><span>POSTGRESQL · FASTAPI · REACT</span></footer>
  </main>;
}
