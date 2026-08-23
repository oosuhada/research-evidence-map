import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  MarkerType,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react';
import { forceCollide, forceSimulation, forceX, forceY } from 'd3-force';
import rough from 'roughjs';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Asterisk,
  BookOpenText,
  Braces,
  CircleDot,
  FileText,
  Highlighter,
  Link2,
  Merge,
  MousePointer2,
  Scissors,
  Search,
  Sprout,
  X,
} from 'lucide-react';
import { challengeResponse, signalGardenSources, streamDeterministicText } from './lib/mock-ai';

type InsightKind = 'Pain Point' | 'Job to Be Done' | 'Product Opportunity' | 'Assumption' | 'Contradiction';

type Insight = {
  id: string;
  kind: InsightKind;
  title: string;
  body: string;
  confidence: number;
  sourceIds: string[];
  position: { x: number; y: number };
};

const insights: Insight[] = [
  {
    id: 'pain-trust',
    kind: 'Pain Point',
    title: 'The trust tax',
    body: 'Teams lose the time they saved to reconstruct where an AI answer came from.',
    confidence: 92,
    sourceIds: ['interview-01', 'meeting-09'],
    position: { x: 500, y: 80 },
  },
  {
    id: 'job-audit',
    kind: 'Job to Be Done',
    title: 'Audit without leaving the flow',
    body: 'Reveal exact evidence at the moment a decision is challenged.',
    confidence: 88,
    sourceIds: ['review-04', 'support-12'],
    position: { x: 800, y: 245 },
  },
  {
    id: 'opp-evidence',
    kind: 'Product Opportunity',
    title: 'Evidence-on-demand workspace',
    body: 'Organize source material around a decision and disclose provenance progressively.',
    confidence: 84,
    sourceIds: ['review-04', 'support-12', 'interview-07', 'review-11'],
    position: { x: 510, y: 430 },
  },
  {
    id: 'assumption-speed',
    kind: 'Assumption',
    title: 'Provenance will not slow experts',
    body: 'Power users accept evidence affordances if the default workspace stays fast.',
    confidence: 53,
    sourceIds: ['interview-07'],
    position: { x: 210, y: 450 },
  },
  {
    id: 'contra-detail',
    kind: 'Contradiction',
    title: 'More detail can reduce clarity',
    body: 'Some users want disagreement surfaced, but not a permanent wall of citations.',
    confidence: 67,
    sourceIds: ['review-11'],
    position: { x: 900, y: 500 },
  },
];

const clusterCenters: Record<string, { x: number; y: number }> = {
  'Trust gap': { x: 160, y: 150 },
  Traceability: { x: 1020, y: 190 },
  'Decision context': { x: 160, y: 520 },
  Contradiction: { x: 1020, y: 520 },
};

type SeedDatum = { id: string; cluster: string; x?: number; y?: number };

function clusteredSeedPositions() {
  const points: SeedDatum[] = signalGardenSources.map((source, index) => ({
    id: source.id,
    cluster: source.cluster,
    x: 600 + Math.cos(index * 1.7) * 160,
    y: 330 + Math.sin(index * 1.7) * 120,
  }));

  const simulation = forceSimulation(points)
    .force('x', forceX<SeedDatum>((datum) => clusterCenters[datum.cluster]?.x ?? 600).strength(0.34))
    .force('y', forceY<SeedDatum>((datum) => clusterCenters[datum.cluster]?.y ?? 330).strength(0.34))
    .force('collision', forceCollide<SeedDatum>(92).strength(0.88))
    .stop();

  for (let tick = 0; tick < 140; tick += 1) simulation.tick();
  return new Map(points.map((point) => [point.id, { x: point.x ?? 0, y: point.y ?? 0 }]));
}

function ProofMark({ kind }: { kind: 'circle' | 'underline' | 'strike' }) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.replaceChildren();
    const rc = rough.svg(svg);
    const options = { stroke: '#d04937', strokeWidth: 1.4, roughness: 1.7, bowing: 1.2 };
    const mark = kind === 'circle'
      ? rc.ellipse(28, 18, 48, 28, options)
      : kind === 'underline'
        ? rc.line(4, 28, 54, 24, options)
        : rc.line(4, 4, 54, 30, options);
    svg.appendChild(mark);
  }, [kind]);

  return <svg className="proof-mark" ref={ref} viewBox="0 0 58 36" aria-hidden="true" />;
}

function SeedCard({ source, index }: { source: (typeof signalGardenSources)[number]; index: number }) {
  return (
    <article className="seed-card">
      <div className="seed-index">0{index + 1}</div>
      <div className="seed-copy">
        <span>{source.source}</span>
        <p>“{source.quote}”</p>
      </div>
      <CircleDot className="seed-pin" size={18} />
    </article>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const isContradiction = insight.kind === 'Contradiction';
  const isAssumption = insight.kind === 'Assumption';
  return (
    <article className={`insight-card kind-${insight.kind.toLowerCase().replaceAll(' ', '-')} ${isContradiction ? 'is-contradiction' : ''}`}>
      <div className="insight-topline">
        <span>{insight.kind}</span>
        <b>{insight.confidence}%</b>
      </div>
      <h3>{insight.title}</h3>
      <p>{insight.body}</p>
      <div className="evidence-rule"><i style={{ width: `${insight.confidence}%` }} /></div>
      {isContradiction ? <ProofMark kind="strike" /> : isAssumption ? <ProofMark kind="circle" /> : null}
    </article>
  );
}

function Garden() {
  const reducedMotion = useReducedMotion();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [phase, setPhase] = useState<'empty' | 'seeding' | 'growing' | 'complete'>('empty');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [challenge, setChallenge] = useState('');
  const [challenging, setChallenging] = useState(false);
  const [fieldMode, setFieldMode] = useState<'clustered' | 'merged' | 'split'>('clustered');
  const runRef = useRef(0);
  const seedPositions = useMemo(() => clusteredSeedPositions(), []);

  const selectedInsight = useMemo(() => insights.find((item) => item.id === selectedId) ?? null, [selectedId]);
  const selectedSource = useMemo(() => signalGardenSources.find((item) => item.id === selectedId) ?? null, [selectedId]);
  const relatedSources = useMemo(
    () => selectedInsight ? signalGardenSources.filter((source) => selectedInsight.sourceIds.includes(source.id)) : [],
    [selectedInsight],
  );

  const makeSourceNode = useCallback((index: number, compact = false): Node => {
    const source = signalGardenSources[index];
    const position = compact
      ? seedPositions.get(source.id) ?? { x: 120 + index * 90, y: 180 }
      : { x: 505 + Math.cos(index * 1.08) * 120, y: 280 + Math.sin(index * 1.08) * 90 };
    return {
      id: source.id,
      position,
      data: { label: <SeedCard source={source} index={index} /> },
      className: `field-node seed-node ${compact ? 'seed-grown' : 'seed-arriving'}`,
      style: { width: compact ? 222 : 190 },
    };
  }, [seedPositions]);

  const analyze = async () => {
    runRef.current += 1;
    const runId = runRef.current;
    setSelectedId(null);
    setChallenge('');
    setEdges([]);
    setNodes([]);
    setPhase('seeding');

    for (let index = 0; index < signalGardenSources.length; index += 1) {
      if (!reducedMotion) await new Promise((resolve) => window.setTimeout(resolve, 115));
      if (runId !== runRef.current) return;
      setNodes((current) => [...current, makeSourceNode(index)]);
    }

    if (!reducedMotion) await new Promise((resolve) => window.setTimeout(resolve, 320));
    if (runId !== runRef.current) return;
    setPhase('growing');
    setNodes([
      ...signalGardenSources.map((_, index) => makeSourceNode(index, true)),
      ...insights.map((insight) => ({
        id: insight.id,
        position: insight.position,
        data: { label: <InsightCard insight={insight} /> },
        className: 'field-node taxonomy-node',
        style: { width: 250 },
      })),
    ]);

    const links: Array<[string, string, boolean]> = [
      ['interview-01', 'pain-trust', false], ['meeting-09', 'pain-trust', false],
      ['review-04', 'job-audit', false], ['support-12', 'job-audit', false],
      ['pain-trust', 'opp-evidence', false], ['job-audit', 'opp-evidence', false],
      ['interview-07', 'assumption-speed', false], ['assumption-speed', 'opp-evidence', false],
      ['review-11', 'contra-detail', true], ['contra-detail', 'opp-evidence', true],
    ];
    setEdges(links.map(([source, target, contradictory], index) => ({
      id: `e-${index}`,
      source,
      target,
      animated: !reducedMotion && !contradictory,
      className: contradictory ? 'proof-edge' : 'ink-edge',
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
    })));

    if (!reducedMotion) await new Promise((resolve) => window.setTimeout(resolve, 420));
    setPhase('complete');
  };

  const rearrange = (mode: 'merged' | 'split') => {
    setFieldMode(mode);
    setNodes((current) => current.map((node, index) => {
      if (!node.id.includes('-') || node.id.startsWith('pain-') || node.id.startsWith('job-') || node.id.startsWith('opp-') || node.id.startsWith('assumption-') || node.id.startsWith('contra-')) return node;
      if (mode === 'merged') return { ...node, position: { x: 480 + (index % 3) * 100, y: 600 + Math.floor(index / 3) * 70 } };
      const source = signalGardenSources.find((item) => item.id === node.id);
      const center = source ? clusterCenters[source.cluster] : { x: 500, y: 300 };
      return { ...node, position: { x: center.x + (index % 2) * 130, y: center.y + (index % 3) * 90 } };
    }));
  };

  const challengeOpportunity = async () => {
    setChallenge('');
    setChallenging(true);
    await streamDeterministicText(challengeResponse, {
      delay: reducedMotion ? 0 : 13,
      chunkSize: reducedMotion ? challengeResponse.length : 5,
      onChunk: (chunk) => setChallenge((current) => current + chunk),
    });
    setChallenging(false);
  };

  const statusCopy = phase === 'empty' ? 'FIELD NOTE 00 / READY' : phase === 'complete' ? 'FIELD NOTE 06 / MAPPED' : 'FIELD NOTE / ANALYZING';

  return (
    <main className="garden-shell">
      <header className="masthead">
        <div className="journal-mark"><Sprout size={20} /><span>Signal Garden</span></div>
        <div className="edition">AI PRODUCT DISCOVERY CANVAS<br />RESEARCH EDITION · 2026</div>
        <div className="masthead-status"><i className={phase === 'complete' ? 'done' : ''} />{statusCopy}</div>
      </header>

      <section className="editorial-intro">
        <div className="folio">01</div>
        <div>
          <span className="kicker">CUSTOMER EVIDENCE / OPPORTUNITY CARTOGRAPHY</span>
          <h1>Turn scattered customer signals into <em>evidence-backed product opportunities.</em></h1>
        </div>
        <aside>
          <p>Six source fragments. Four evidence families. One product decision.</p>
          <button className="ink-button" onClick={analyze} disabled={phase === 'seeding' || phase === 'growing'}>
            <Highlighter size={15} /> {phase === 'empty' ? 'Analyze sample' : 'Re-run field study'} <ArrowDownRight size={15} />
          </button>
        </aside>
      </section>

      <section className="map-frame">
        <div className="map-index">
          <span>FIELD MAP / TRUST & TRACEABILITY</span>
          <div className="map-actions">
            <button onClick={() => rearrange('merged')} className={fieldMode === 'merged' ? 'active' : ''}><Merge size={13} /> Merge evidence</button>
            <button onClick={() => rearrange('split')} className={fieldMode === 'split' ? 'active' : ''}><Scissors size={13} /> Split clusters</button>
          </div>
        </div>

        {phase === 'empty' ? (
          <div className="empty-field">
            <div className="seed-specimen">
              {Array.from({ length: 6 }).map((_, index) => <i key={index} style={{ '--i': index } as React.CSSProperties} />)}
              <Sprout size={32} />
            </div>
            <div>
              <span>UNPROCESSED MATERIAL</span>
              <h2>Six signals are waiting to be planted.</h2>
              <p>Interviews, support tickets, product reviews, and meeting notes will become a navigable evidence map.</p>
            </div>
          </div>
        ) : (
          <div className="flow-field">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              fitView
              fitViewOptions={{ padding: 0.15, duration: reducedMotion ? 0 : 700 }}
              minZoom={0.45}
              maxZoom={1.65}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#d7d0bf" gap={28} size={1} />
              <Controls showInteractive={false} position="bottom-left" />
              <MiniMap position="bottom-right" pannable zoomable nodeStrokeWidth={2} />
            </ReactFlow>
            <div className="map-legend">
              <span><i className="legend-source" />source</span>
              <span><i className="legend-insight" />synthesis</span>
              <span><i className="legend-proof" />contradiction</span>
            </div>
            {(phase === 'seeding' || phase === 'growing') ? (
              <motion.div className="analysis-stamp" initial={{ opacity: 0, rotate: -3 }} animate={{ opacity: 1, rotate: -1 }}>
                <Search size={13} /> {phase === 'seeding' ? 'cataloguing source language' : 'growing evidence clusters'}
              </motion.div>
            ) : null}
          </div>
        )}
      </section>

      <AnimatePresence>
        {(selectedInsight || selectedSource) ? (
          <motion.aside
            className="evidence-ledger"
            initial={{ x: 430 }}
            animate={{ x: 0 }}
            exit={{ x: 430 }}
            transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <button className="ledger-close" onClick={() => setSelectedId(null)} aria-label="Close evidence inspector"><X size={17} /></button>
            <div className="ledger-heading">
              <BookOpenText size={18} />
              <span>EVIDENCE LEDGER / SOURCE TRACE</span>
            </div>

            {selectedInsight ? (
              <>
                <div className="ledger-folio">{selectedInsight.kind.toUpperCase()}</div>
                <h2>{selectedInsight.title}</h2>
                <p className="ledger-summary">{selectedInsight.body}</p>
                <div className="confidence-sheet">
                  <strong>{selectedInsight.confidence}</strong><span>%</span>
                  <p>confidence from {selectedInsight.sourceIds.length} traced source{selectedInsight.sourceIds.length > 1 ? 's' : ''}</p>
                  <ProofMark kind="underline" />
                </div>
                <div className="source-ledger-list">
                  {relatedSources.map((source, index) => (
                    <button key={source.id} onClick={() => setSelectedId(source.id)}>
                      <span>0{index + 1}</span>
                      <div><b>{source.source}</b><p>“{source.quote}”</p></div>
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                </div>
                {selectedInsight.kind === 'Product Opportunity' ? (
                  <div className="challenge-note">
                    <div className="challenge-title"><Asterisk size={16} /><b>Margin challenge</b></div>
                    <button onClick={challengeOpportunity} disabled={challenging}>Challenge this opportunity <Braces size={14} /></button>
                    {challenge ? <p>{challenge}<span className={challenging ? 'typing-caret' : ''} /></p> : <small>Ask the model to actively seek evidence that weakens this opportunity.</small>}
                  </div>
                ) : null}
              </>
            ) : selectedSource ? (
              <>
                <div className="ledger-folio">PRIMARY SOURCE</div>
                <h2>{selectedSource.source}</h2>
                <blockquote>“{selectedSource.quote}”</blockquote>
                <div className="source-meta"><FileText size={16} /><span>Cluster</span><b>{selectedSource.cluster}</b></div>
                <button className="source-return" onClick={() => setSelectedId(null)}><MousePointer2 size={14} /> Return to field map</button>
              </>
            ) : null}
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <footer className="garden-footer">
        <span>METHOD / SEMANTIC CLUSTERING + HUMAN-READABLE PROVENANCE</span>
        <span><Link2 size={12} /> SOURCES REMAIN TRACEABLE</span>
      </footer>
    </main>
  );
}

export function App() {
  return <ReactFlowProvider><Garden /></ReactFlowProvider>;
}
