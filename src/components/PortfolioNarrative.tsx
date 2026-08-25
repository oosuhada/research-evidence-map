import { useState } from 'react';

const traceStages = [
  { code: '01 / SOURCE', title: 'Original interview', body: '“I need every important claim linked to the exact source because I have to defend the decision.”' },
  { code: '02 / FRAGMENT', title: 'Exact source fragment', body: 'The imported document is split into addressable fragments, so synthesis never replaces the source.' },
  { code: '03 / EVIDENCE', title: 'Human-reviewed evidence', body: 'AI proposes a claim. A researcher accepts, edits, or rejects it before it can support a conclusion.' },
  { code: '04 / OPPORTUNITY', title: 'Traceable opportunity', body: '“Make AI synthesis traceable without forcing audit detail into every task.” Every supporting claim remains inspectable.' },
];

const story = [
  ['BEFORE', 'Research lived in documents, dashboards, and summaries that lost their source trail.'],
  ['PROBLEM', 'A polished synthesis is hard to trust when nobody can answer “who actually said this?”'],
  ['INSIGHT', 'Treat AI output as a proposal and preserve provenance as part of the domain model.'],
  ['ARCHITECTURE', 'Source → Fragment → Evidence → Cluster → Opportunity, with review state and history at every boundary.'],
  ['INTERACTION', 'Trace a conclusion backward, challenge it, expose contradictions, and compare recurring signals across workspaces.'],
  ['RESULT', 'Research becomes cumulative organizational memory instead of a folder of one-off summaries.'],
];

export function PortfolioNarrative() {
  const [activeTrace, setActiveTrace] = useState(3);
  const stage = traceStages[activeTrace];

  return (
    <section className="portfolio-narrative" aria-labelledby="portfolio-case-title">
      <div className="portfolio-thesis-row">
        <span>INSPECTABLE AI SYSTEMS / 01</span>
        <p>AI may synthesize research. It should never erase the evidence needed to challenge that synthesis.</p>
      </div>

      <div className="killer-demo">
        <div className="killer-copy">
          <span>KILLER INTERACTION / TRACE ONE CONCLUSION</span>
          <h2 id="portfolio-case-title">Follow a product conclusion all the way back to the sentence that produced it.</h2>
          <p>This synthetic micro-example mirrors the same provenance chain used by imported research in the real workspace.</p>
        </div>
        <div className="trace-demo" aria-label="Interactive provenance trace">
          <div className="trace-rail">
            {traceStages.map((item, index) => (
              <button key={item.code} type="button" className={index === activeTrace ? 'active' : index < activeTrace ? 'passed' : ''} onClick={() => setActiveTrace(index)}>
                <span>{item.code}</span><i />
              </button>
            ))}
          </div>
          <article><span>{stage.code}</span><strong>{stage.title}</strong><p>{stage.body}</p><small>SYNTHETIC DEMONSTRATOR · NOT OBSERVED CUSTOMER EVIDENCE</small></article>
        </div>
      </div>

      <div className="approach-compare">
        <article className="common-approach"><span>COMMON AI RESEARCH FLOW</span><strong>Documents → summary → recommendation</strong><p>The conclusion is fast to produce, but provenance becomes an afterthought and disagreement is flattened.</p></article>
        <div className="compare-vs">VS</div>
        <article className="our-approach"><span>THIS SYSTEM</span><strong>Source → fragment → reviewed evidence → opportunity</strong><p>Traceability, contradiction, review state, and research memory remain first-class product behavior.</p></article>
      </div>

      <div className="architecture-card">
        <div><span>ARCHITECTURE / TRUST PATH</span><h3>AI is an adapter around a source-of-truth model.</h3></div>
        <div className="architecture-flow" aria-label="Research Evidence Map architecture">
          {['SOURCE', 'FRAGMENT', 'AI PROPOSAL', 'HUMAN REVIEW', 'CLUSTER', 'OPPORTUNITY', 'RESEARCH MEMORY'].map((node, index) => <span key={node} className={index === 2 ? 'ai-node' : index === 3 ? 'human-node' : ''}>{node}</span>)}
        </div>
      </div>

      <div className="case-story">
        {story.map(([label, body], index) => <article key={label}><span>{String(index + 1).padStart(2, '0')} / {label}</span><p>{body}</p></article>)}
      </div>
    </section>
  );
}
