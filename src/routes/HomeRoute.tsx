import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Database, Play, Plus, Sprout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/RouteState';
import { PortfolioNarrative } from '../components/PortfolioNarrative';
import { ResearchMemory } from '../features/memory/ResearchMemory';
import type { WorkspaceSummary } from '../schemas/domain';

const guidedDemoSources = [
  { name: 'Synthetic interview · Product manager', source_type: 'interview', participant: 'Synthetic PM', channel: 'Research interview', created_date: null, detected_encoding: 'utf-8', content: 'I do not need another AI summary. I need every important claim linked to the exact source because I have to defend the decision in a review meeting.' },
  { name: 'Synthetic support thread · Enterprise approval', source_type: 'support', participant: 'Synthetic enterprise user', channel: 'Support', created_date: null, detected_encoding: 'utf-8', content: 'Our approvers will not accept AI-generated synthesis unless each statement links back to the original customer record and preserves disagreement.' },
  { name: 'Synthetic app review · Power user', source_type: 'app-review', participant: 'Synthetic reviewer', channel: 'App review', created_date: null, detected_encoding: 'utf-8', content: 'However, detailed provenance slows routine work. I want source links on demand rather than opening a full audit trail for every simple task.' },
  { name: 'Synthetic research note · Decision context', source_type: 'meeting-note', participant: 'Synthetic research team', channel: 'Research note', created_date: null, detected_encoding: 'utf-8', content: 'The team needs evidence grouped around the decision they are making this week, not a generic summary of everything customers said.' },
];

const sampleResearchLibrary = [
  {
    name: 'Example · Trust & approval',
    description: 'How much provenance do teams need before they will act on AI-assisted research synthesis?',
    cluster: 'Control and provenance',
    opportunity: 'Progressive provenance for high-stakes review',
    opportunityBody: 'Keep routine synthesis lightweight, but make source fragments and disagreement one interaction away when approval stakes rise.',
    contradiction: 'Enterprise approvers want source detail visible during review, while a power user says always-visible provenance creates friction in routine work.',
    sources: guidedDemoSources,
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
    catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Could not load workspaces.'); }
    return () => controller.abort();
  }, []);

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
        setError(cause instanceof Error ? cause.message : 'Could not prepare the example research library.');
      } finally {
        bootstrappingSamples.current = false;
      }
    })();
  }, [load, workspaces]);

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
      const prior = await api.createWorkspace('Guided demo · Prior trust study', 'Synthetic earlier study used to demonstrate recurring research memory across separate workspaces.');
      await api.commitImport(prior.id, guidedDemoSources.slice(0, 2), false);
      let priorDetail = await api.getWorkspace(prior.id);
      await api.analyze(prior.id, priorDetail.sources.map((source) => source.id));
      priorDetail = await api.getWorkspace(prior.id);
      await Promise.all(priorDetail.evidence.map((evidence) => api.patchEvidence(evidence.id, { review_state: 'accepted' })));
      priorDetail = await api.getWorkspace(prior.id);
      if (priorDetail.evidence.length) await api.createCluster(prior.id, 'Traceable AI trust', priorDetail.evidence.slice(0, 2).map((evidence) => evidence.id));

      const workspace = await api.createWorkspace('Guided demo · Evidence traceability', 'Synthetic onboarding workspace showing the complete source → evidence → opportunity workflow.');
      await api.commitImport(workspace.id, guidedDemoSources, false);
      let detail = await api.getWorkspace(workspace.id);
      await api.analyze(workspace.id, detail.sources.map((source) => source.id));
      detail = await api.getWorkspace(workspace.id);
      await Promise.all(detail.evidence.map((evidence) => api.patchEvidence(evidence.id, { review_state: 'accepted' })));
      detail = await api.getWorkspace(workspace.id);
      if (detail.evidence.length) await api.createCluster(workspace.id, 'Traceable AI trust', detail.evidence.slice(0, 3).map((evidence) => evidence.id));
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
    <section className="home-hero"><span className="portfolio-hero-thesis">RESEARCH EVIDENCE MAP · SOURCE-TRACEABLE SYNTHESIS</span><span className="kicker">RESEARCH EVIDENCE / SOURCE TRACEABILITY</span><h1>Turn scattered customer research into conclusions you can <em>trace back to the sentence.</em></h1><p>Import interviews, reviews, support threads, and meeting notes. Every synthesis remains reviewable, editable, reversible, and traceable to an exact source fragment.</p><div className="home-quickstart"><button type="button" className="ink-button" onClick={() => void createGuidedDemo()} disabled={demoBusy}><Play size={15} fill="currentColor" />{demoBusy ? 'Preparing guided demo…' : 'Try guided demo'}</button><div><strong>New here?</strong><span>Explore the sample research library below or create a guided workspace through the real analysis flow.</span></div></div></section>
    <section className="onboarding-strip" aria-label="How the product works"><article><span>01</span><div><strong>Import source material</strong><p>Interviews, reviews, support threads, or notes enter as source documents and exact fragments.</p></div></article><article><span>02</span><div><strong>Review the synthesis</strong><p>AI output stays proposed until you accept, edit, reject, merge, or split it.</p></div></article><article><span>03</span><div><strong>Act on the evidence</strong><p>Derive opportunities, inspect research gaps, challenge assumptions, then export or share.</p></div></article></section>
    <PortfolioNarrative workspaceId={workspaces?.[0]?.id ?? null} />
    <ResearchMemory />
    <div className="home-grid">
      <form className="create-workspace" onSubmit={(event) => void create(event)}><div className="panel-heading"><div><span>STEP 01 / RESEARCH QUESTION</span><h2>Create workspace</h2></div><Plus size={21} /></div><label>Workspace name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Q3 onboarding discovery" autoFocus /></label><label>Research question / description<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are we trying to learn or decide?" /></label><button className="ink-button" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create workspace'}<ArrowRight size={16} /></button><small>Local mode stores research in the configured database. AI analysis uses the deterministic reference adapter unless an external provider is explicitly configured.</small></form>
      <section className="workspace-index"><div className="panel-heading"><div><span>RESEARCH ARCHIVE</span><h2>Saved research</h2></div><Database size={20} /></div>{error ? <ErrorState detail={error} retry={() => void load()} /> : workspaces === null ? <LoadingState label="Reading saved research…" /> : workspaces.length === 0 ? <LoadingState label="Preparing example research library…" /> : <div className="workspace-list">{workspaces.map((workspace, index) => <button key={workspace.id} onClick={() => navigate(`/w/${workspace.id}`)}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{workspace.name}</b><p>{workspace.description || 'No research description'}</p><small>{workspace.name.startsWith('Example ·') ? 'SAVED EXAMPLE · ' : ''}{new Date(workspace.updated_at).toLocaleString()}</small></div><ArrowRight size={16} /></button>)}</div>}</section>
    </div>
    <footer className="garden-footer"><span>METHOD / HUMAN-REVIEWED SYNTHESIS + SOURCE PROVENANCE</span><span>POSTGRESQL · FASTAPI · REACT</span></footer>
  </main>;
}
