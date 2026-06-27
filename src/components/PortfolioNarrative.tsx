import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Database, Server, Sparkles, UserCheck } from 'lucide-react';
import { api } from '../api/client';
import type { WorkspaceDetail } from '../schemas/domain';

const story = [
  ['BEFORE', 'Research lived in documents, dashboards, and summaries that lost their source trail.'],
  ['PROBLEM', 'A polished synthesis is hard to trust when nobody can answer “who actually said this?”'],
  ['INSIGHT', 'Treat AI output as a proposal and preserve provenance as part of the domain model.'],
  ['ARCHITECTURE', 'Source → Fragment → Evidence → Cluster → Opportunity, with review state and history at every boundary.'],
  ['INTERACTION', 'Trace a conclusion backward, challenge it, expose contradictions, and compare recurring signals across workspaces.'],
  ['RESULT', 'Research becomes cumulative organizational memory instead of a folder of one-off summaries.'],
];

const series = [
  ['01', 'Research', 'https://signals.oosu.dev/'],
  ['02', 'Decisions', 'https://scenario.oosu.dev/'],
  ['03', 'Generative UI', 'https://decision.oosu.dev/'],
  ['04', 'Memory', 'https://memory.oosu.dev/'],
] as const;

type TraceStage = { code: string; title: string; body: string; meta: string };

function fallbackStages(): TraceStage[] {
  return [
    { code: '01 / SOURCE', title: 'No persisted trace yet', body: 'Create the guided demo or import research to generate a real source-backed trace.', meta: 'Fallback explanation only' },
    { code: '02 / FRAGMENT', title: 'Addressable source fragment', body: 'Imported documents are split into exact fragments with locators and character ranges.', meta: 'Source truth remains separately addressable' },
    { code: '03 / EVIDENCE', title: 'Human-reviewed evidence', body: 'AI-proposed evidence remains proposed until a human accepts, edits, or rejects it.', meta: 'Review state is persisted' },
    { code: '04 / OPPORTUNITY', title: 'Traceable opportunity', body: 'Opportunities keep explicit links to the evidence items that support them.', meta: 'Conclusion never replaces evidence' },
  ];
}

export function PortfolioNarrative({ workspaceId }: { workspaceId?: string | null }) {
  const [activeTrace, setActiveTrace] = useState(3);
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);

  useEffect(() => {
    if (!workspaceId) { setDetail(null); return undefined; }
    const controller = new AbortController();
    void api.getWorkspace(workspaceId, controller.signal).then(setDetail).catch(() => setDetail(null));
    return () => controller.abort();
  }, [workspaceId]);

  const liveTrace = useMemo(() => {
    if (!detail) return null;
    const opportunity = detail.opportunities.find((item) => item.evidence_item_ids.length > 0) ?? detail.opportunities[0];
    const evidence = opportunity
      ? detail.evidence.find((item) => opportunity.evidence_item_ids.includes(item.id) && item.source_fragment_ids.length > 0)
      : detail.evidence.find((item) => item.source_fragment_ids.length > 0);
    const fragment = evidence ? detail.fragments.find((item) => item.id === evidence.source_fragment_ids[0]) : undefined;
    const source = fragment ? detail.sources.find((item) => item.id === fragment.source_document_id) : undefined;
    if (!opportunity || !evidence || !fragment || !source) return null;
    return { opportunity, evidence, fragment, source };
  }, [detail]);

  const stages: TraceStage[] = liveTrace ? [
    { code: '01 / SOURCE', title: liveTrace.source.name, body: liveTrace.fragment.text, meta: `${liveTrace.fragment.locator}${liveTrace.source.participant ? ` · ${liveTrace.source.participant}` : ''}` },
    { code: '02 / FRAGMENT', title: `Fragment ${liveTrace.fragment.ordinal + 1}`, body: liveTrace.fragment.text, meta: `chars ${liveTrace.fragment.char_start}–${liveTrace.fragment.char_end} · persisted locator ${liveTrace.fragment.locator}` },
    { code: '03 / EVIDENCE', title: liveTrace.evidence.title, body: liveTrace.evidence.body, meta: `${liveTrace.evidence.review_state.toUpperCase()} · ${liveTrace.evidence.provider}/${liveTrace.evidence.model} · ${liveTrace.evidence.source_fragment_ids.length} source fragment${liveTrace.evidence.source_fragment_ids.length === 1 ? '' : 's'}` },
    { code: '04 / OPPORTUNITY', title: liveTrace.opportunity.title, body: liveTrace.opportunity.body, meta: `${liveTrace.opportunity.evidence_item_ids.length} linked evidence · ${liveTrace.opportunity.review_state.toUpperCase()}` },
  ] : fallbackStages();
  const stage = stages[activeTrace];

  const liveWorkspaceHref = liveTrace && detail
    ? `/w/${detail.workspace.id}?view=list&opportunity=${liveTrace.opportunity.id}&evidence=${liveTrace.evidence.id}`
    : null;

  return (
    <section className="portfolio-narrative" aria-labelledby="portfolio-case-title">
      <div className="portfolio-thesis-row">
        <span>INSPECTABLE AI SYSTEMS / 01</span>
        <p>AI may synthesize research. It should never erase the evidence needed to challenge that synthesis.</p>
      </div>

      <div className="killer-demo">
        <div className="killer-copy">
          <span>KILLER INTERACTION / TRACE ONE REAL CONCLUSION</span>
          <h2 id="portfolio-case-title">Follow a persisted opportunity all the way back to the exact source sentence.</h2>
          <p>{liveTrace ? 'This trace is assembled from the latest persisted workspace returned by the real API—not a separate marketing formula.' : 'No traceable workspace is available yet. The guided demo will create one through the same API used by the product.'}</p>
          {liveWorkspaceHref ? <a className="portfolio-live-link" href={liveWorkspaceHref}>Open this trace in the workspace <ArrowUpRight size={13} /></a> : null}
        </div>
        <div className="trace-demo" aria-label="Interactive provenance trace" data-proof={liveTrace ? 'persisted' : 'fallback'}>
          <div className="trace-rail">
            {stages.map((item, index) => (
              <button key={item.code} type="button" className={index === activeTrace ? 'active' : index < activeTrace ? 'passed' : ''} onClick={() => setActiveTrace(index)}>
                <span>{item.code}</span><i />
              </button>
            ))}
          </div>
          <article><span>{stage.code}</span><strong>{stage.title}</strong><p>{stage.body}</p><small>{stage.meta}</small></article>
        </div>
      </div>

      <details className="engineering-case">
        <summary><span>ENGINEERING CASE STUDY</span><b>Problem → architecture → result</b></summary>
        <div className="engineering-case-body">
          <div className="approach-compare">
            <article className="common-approach"><span>COMMON AI RESEARCH FLOW</span><strong>Documents → summary → recommendation</strong><p>The conclusion is fast to produce, but provenance becomes an afterthought and disagreement is flattened.</p></article>
            <div className="compare-vs">VS</div>
            <article className="our-approach"><span>THIS SYSTEM</span><strong>Source → fragment → reviewed evidence → opportunity</strong><p>Traceability, contradiction, review state, and research memory remain first-class product behavior.</p></article>
          </div>

          <div className="system-architecture" id="architecture">
            <header><span>ARCHITECTURE / REAL TRUST + DATA FLOW</span><h3>AI is an adapter around a source-of-truth research domain.</h3></header>
            <div className="architecture-lanes">
              <article><span>INTERACTION</span><b>React workspace</b><small>review · trace · cluster · opportunity · memory</small></article>
              <i>→</i>
              <article><Server size={15} /><span>DOMAIN API</span><b>FastAPI</b><small>source / fragment / evidence / opportunity contracts</small></article>
              <i>→</i>
              <article><Database size={15} /><span>SOURCE OF TRUTH</span><b>PostgreSQL</b><small>provenance · review state · edit history</small></article>
              <article className="architecture-side"><Sparkles size={15} /><span>AI BOUNDARY</span><b>Provider adapter</b><small>structured proposal only; never source truth</small></article>
              <article className="architecture-side human"><UserCheck size={15} /><span>HUMAN BOUNDARY</span><b>Explicit review</b><small>accept / edit / reject / challenge / undo</small></article>
            </div>
          </div>

          <div className="case-story">
            {story.map(([label, body], index) => <article key={label}><span>{String(index + 1).padStart(2, '0')} / {label}</span><p>{body}</p></article>)}
          </div>

          <nav className="series-nav" aria-label="Inspectable AI Systems series">
            {series.map(([index, label, href]) => <a key={index} className={index === '01' ? 'active' : ''} href={href}><span>{index}</span><b>{label}</b></a>)}
          </nav>
        </div>
      </details>
    </section>
  );
}
