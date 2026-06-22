import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowLeft, BrainCircuit, CircleDotDashed, FileText, Link2, Search, Sparkles, Sprout, X } from 'lucide-react';
import { AmbientBackdrop, Eyebrow, GlassCard, GlowButton, PointerLight, StatusPill } from './lib/design-system';
import { challengeResponse, signalGardenSources, streamDeterministicText } from './lib/mock-ai';

type InsightKind = 'Source' | 'Pain Point' | 'Job to Be Done' | 'Product Opportunity' | 'Assumption' | 'Contradicting Evidence';
type GardenData = {
  title: string;
  kind: InsightKind;
  body: string;
  confidence: number;
  sourceIds: string[];
  tone?: 'clear' | 'uncertain' | 'contradictory';
};

const insights: Array<{ id: string; position: { x: number; y: number }; data: GardenData }> = [
  {
    id: 'pain-trust', position: { x: 570, y: 80 },
    data: { title: 'The trust tax', kind: 'Pain Point', body: 'Teams spend post-analysis time reconstructing how AI reached an answer.', confidence: 92, sourceIds: ['interview-01', 'meeting-09'], tone: 'clear' },
  },
  {
    id: 'job-audit', position: { x: 870, y: 285 },
    data: { title: 'Audit without leaving flow', kind: 'Job to Be Done', body: 'When a decision is challenged, show exact source evidence without forcing a context switch.', confidence: 88, sourceIds: ['review-04', 'support-12'], tone: 'clear' },
  },
  {
    id: 'opp-evidence', position: { x: 610, y: 480 },
    data: { title: 'Evidence-on-demand workspace', kind: 'Product Opportunity', body: 'Organize source material around a decision and reveal provenance progressively.', confidence: 84, sourceIds: ['review-04', 'support-12', 'interview-07', 'review-11'], tone: 'clear' },
  },
  {
    id: 'assumption-speed', position: { x: 240, y: 535 },
    data: { title: 'Provenance won’t slow experts', kind: 'Assumption', body: 'Power users will accept evidence affordances if the default workspace remains fast.', confidence: 53, sourceIds: ['interview-07'], tone: 'uncertain' },
  },
  {
    id: 'contra-smooth', position: { x: 980, y: 540 },
    data: { title: 'More detail can reduce clarity', kind: 'Contradicting Evidence', body: 'Some users want disagreement surfaced, but not a permanent wall of citations.', confidence: 67, sourceIds: ['review-11'], tone: 'contradictory' },
  },
];

const sourcePositions = [
  { x: 70, y: 70 }, { x: 78, y: 225 }, { x: 1030, y: 110 }, { x: 340, y: 32 }, { x: 70, y: 390 }, { x: 1040, y: 360 },
];

function SourceNodeContent({ source, index }: { source: (typeof signalGardenSources)[number]; index: number }) {
  return (
    <div className="source-node-inner">
      <span className="node-kicker"><FileText size={11} /> Source 0{index + 1}</span>
      <strong>{source.source}</strong>
      <p>“{source.quote}”</p>
      <span className="cluster-tag">{source.cluster}</span>
    </div>
  );
}

function InsightNodeContent({ data }: { data: GardenData }) {
  const icon = data.kind === 'Contradicting Evidence' ? <AlertTriangle size={12} /> : data.kind === 'Assumption' ? <CircleDotDashed size={12} /> : <Sparkles size={12} />;
  return (
    <div className="insight-node-inner">
      <span className="node-kicker">{icon}{data.kind}</span>
      <strong>{data.title}</strong>
      <p>{data.body}</p>
      <div className="confidence-line"><span>Evidence confidence</span><b>{data.confidence}%</b></div>
      <div className="confidence-track"><i style={{ width: `${data.confidence}%` }} /></div>
    </div>
  );
}

function Garden() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [phase, setPhase] = useState<'empty' | 'analyzing' | 'complete'>('empty');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [challenge, setChallenge] = useState('');
  const [challenging, setChallenging] = useState(false);
  const runRef = useRef(0);

  const selectedInsight = useMemo(() => insights.find((item) => item.id === selectedId)?.data ?? null, [selectedId]);
  const relatedSources = useMemo(() => selectedInsight ? signalGardenSources.filter((source) => selectedInsight.sourceIds.includes(source.id)) : [], [selectedInsight]);

  const onConnect = useCallback((connection: Connection) => setEdges((current) => addEdge(connection, current)), [setEdges]);

  const analyze = async () => {
    runRef.current += 1;
    const runId = runRef.current;
    setPhase('analyzing');
    setSelectedId(null);
    setChallenge('');
    setEdges([]);
    setNodes([]);

    for (let index = 0; index < signalGardenSources.length; index += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 150));
      if (runId !== runRef.current) return;
      const source = signalGardenSources[index];
      setNodes((current) => [
        ...current,
        {
          id: source.id,
          position: sourcePositions[index],
          data: { label: <SourceNodeContent source={source} index={index} /> },
          className: 'garden-node source-node',
          style: { width: 250 },
        },
      ]);
    }

    await new Promise((resolve) => window.setTimeout(resolve, 420));
    if (runId !== runRef.current) return;

    setNodes((current) => [
      ...current.map((node, index) => ({
        ...node,
        position: {
          x: index < 3 ? 105 + index * 34 : 1040 - (index - 3) * 38,
          y: 145 + (index % 3) * 180,
        },
        style: { ...node.style, width: 230, transition: 'transform 900ms cubic-bezier(.2,.8,.2,1)' },
      })),
      ...insights.map((item) => ({
        id: item.id,
        position: item.position,
        data: { label: <InsightNodeContent data={item.data} /> },
        className: `garden-node insight-node tone-${item.data.tone ?? 'clear'}`,
        style: { width: 275 },
      })),
    ]);

    const nextEdges: Edge[] = [
      ['interview-01', 'pain-trust'], ['meeting-09', 'pain-trust'], ['review-04', 'job-audit'], ['support-12', 'job-audit'],
      ['pain-trust', 'opp-evidence'], ['job-audit', 'opp-evidence'], ['interview-07', 'assumption-speed'], ['assumption-speed', 'opp-evidence'],
      ['review-11', 'contra-smooth'], ['contra-smooth', 'opp-evidence'],
    ].map(([source, target], index) => ({
      id: `edge-${index}`, source, target, animated: index < 6, className: index >= 8 ? 'edge-contradiction' : 'evidence-edge',
    }));
    setEdges(nextEdges);
    setPhase('complete');
  };

  const challengeOpportunity = async () => {
    setChallenge('');
    setChallenging(true);
    await streamDeterministicText(challengeResponse, {
      delay: 15,
      chunkSize: 4,
      onChunk: (chunk) => setChallenge((current) => current + chunk),
    });
    setChallenging(false);
  };

  return (
    <main className="garden-shell">
      <AmbientBackdrop accent="122 255 192" />
      <PointerLight />
      <header className="garden-header">
        <div className="brand-lockup">
          <a href="http://localhost:3100" aria-label="Back to launcher"><ArrowLeft size={16} /></a>
          <div><strong>Signal Garden</strong><span>AI Product Discovery Canvas</span></div>
        </div>
        <div className="header-actions">
          <StatusPill status={phase === 'empty' ? 'ready' : phase === 'analyzing' ? 'loading' : 'complete'}>
            {phase === 'empty' ? 'Sample ready' : phase === 'analyzing' ? 'Finding signal structure' : 'Evidence graph complete'}
          </StatusPill>
          <GlowButton onClick={analyze} disabled={phase === 'analyzing'}>{phase === 'empty' ? 'Analyze Sample' : 'Analyze Again'}</GlowButton>
        </div>
      </header>

      <section className="garden-intro">
        <div>
          <Eyebrow>From scattered voice to product evidence</Eyebrow>
          <h1>Turn customer noise into <em>traceable opportunities.</em></h1>
        </div>
        <p>Customer interviews, reviews, support tickets, and meeting notes converge into a decision-ready evidence landscape—without flattening disagreement.</p>
      </section>

      <GlassCard className="garden-stage" intensity="clear">
        <div className="canvas-toolbar">
          <span><Sprout size={14} /> Discovery field</span>
          <div><span>Drag</span><span>Pan</span><span>Zoom</span></div>
        </div>
        {phase === 'empty' ? (
          <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="empty-orbit"><BrainCircuit size={34} /><i /><i /><i /></div>
            <h2>Six raw signals are waiting.</h2>
            <p>Run the deterministic analysis to reveal evidence islands, assumptions, and contradictions.</p>
            <GlowButton onClick={analyze}>Analyze Sample</GlowButton>
          </motion.div>
        ) : (
          <div className="flow-wrap">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => { if (node.id.startsWith('pain-') || node.id.startsWith('job-') || node.id.startsWith('opp-') || node.id.startsWith('assumption-') || node.id.startsWith('contra-')) setSelectedId(node.id); }}
              fitView
              fitViewOptions={{ padding: 0.12, duration: 900 }}
              minZoom={0.45}
              maxZoom={1.8}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="rgba(202,255,230,.12)" gap={26} size={1} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable nodeStrokeWidth={2} />
            </ReactFlow>
            {phase === 'analyzing' ? <div className="analysis-toast"><Search size={13} /> extracting meaning from source language…</div> : null}
          </div>
        )}
      </GlassCard>

      <AnimatePresence>
        {selectedInsight ? (
          <motion.aside className="inspector" initial={{ x: 440, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 440, opacity: 0 }} transition={{ type: 'spring', damping: 30, stiffness: 260 }}>
            <GlassCard className="inspector-panel" intensity={selectedInsight.tone === 'contradictory' ? 'contradictory' : selectedInsight.tone === 'uncertain' ? 'uncertain' : 'clear'}>
              <button className="close-button" onClick={() => setSelectedId(null)} aria-label="Close evidence inspector"><X size={16} /></button>
              <span className="inspector-kicker">Evidence inspector · {selectedInsight.kind}</span>
              <h2>{selectedInsight.title}</h2>
              <p className="inspector-body">{selectedInsight.body}</p>
              <div className="confidence-readout"><strong>{selectedInsight.confidence}%</strong><span>evidence confidence</span></div>
              <div className="source-stack">
                <h3>Source trail</h3>
                {relatedSources.map((source) => (
                  <a key={source.id} href={`#${source.id}`} onClick={(event) => event.preventDefault()}>
                    <div><Link2 size={12} /><span>{source.source}</span></div>
                    <p>{source.quote}</p>
                  </a>
                ))}
              </div>
              {selectedInsight.kind === 'Product Opportunity' ? (
                <div className="challenge-box">
                  <button onClick={challengeOpportunity} disabled={challenging}><AlertTriangle size={14} /> Challenge This Opportunity</button>
                  {challenge ? <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{challenge}<span className={challenging ? 'stream-caret' : ''} /></motion.p> : null}
                </div>
              ) : null}
            </GlassCard>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

export function App() {
  return <ReactFlowProvider><Garden /></ReactFlowProvider>;
}
