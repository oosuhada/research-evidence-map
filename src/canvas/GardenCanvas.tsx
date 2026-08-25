import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  MarkerType,
  type Edge,
  type Node,
} from '@xyflow/react';
import { forceCollide, forceSimulation, forceX, forceY } from 'd3-force';
import rough from 'roughjs';
import { CircleDot, GitBranch, TriangleAlert, X } from 'lucide-react';
import type { WorkspaceDetail } from '../schemas/domain';

type Props = {
  detail: WorkspaceDetail;
  selectedEvidenceId?: string | null;
  selectedOpportunityId?: string | null;
  focusClusterId?: string | null;
  onEvidenceSelect: (id: string) => void;
  onOpportunitySelect: (id: string) => void;
  onClearOpportunity?: () => void;
  lowPower?: boolean;
  focused?: boolean;
};

type Point = { id: string; clusterId: string; x?: number; y?: number };

function ClusterCanopy({ label, count }: { label: string; count: number }) {
  const ref = useRef<SVGSVGElement | null>(null);
  const width = Math.min(360, 184 + Math.sqrt(count) * 42);
  const height = Math.min(260, 116 + Math.sqrt(count) * 34);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.replaceChildren();
    ref.current.appendChild(rough.svg(ref.current).ellipse(width / 2, height / 2, width - 8, height - 8, {
      stroke: '#6e7d63', strokeWidth: 1.1, roughness: 1.8, bowing: 1.3,
      fill: 'rgba(107, 131, 92, 0.035)', fillStyle: 'hachure', hachureGap: 18, hachureAngle: -28,
    }));
  }, [height, width]);
  return <div className="cluster-canopy" style={{ width, height }}><svg ref={ref} viewBox={`0 0 ${width} ${height}`} /><span>{label}</span><b>{count} SIGNAL{count === 1 ? '' : 'S'}</b></div>;
}

function EvidenceNode({ title, kind, reviewState, selected }: { title: string; kind: string; reviewState: string; selected: boolean }) {
  return <article className={`field-evidence-node ${selected ? 'is-selected' : ''}`}>
    <CircleDot size={15} className="seed-pin" />
    <span>{kind} · {reviewState}</span>
    <strong>{title}</strong>
  </article>;
}

function OpportunityNode({ title, selected }: { title: string; selected: boolean }) {
  return <article className={`field-opportunity-node ${selected ? 'is-selected' : ''}`}><span>PRODUCT OPPORTUNITY</span><strong>{title}</strong></article>;
}

export function GardenCanvas({ detail, selectedEvidenceId, selectedOpportunityId, focusClusterId, onEvidenceSelect, onOpportunitySelect, onClearOpportunity, lowPower = false, focused = false }: Props) {
  const [contradictionLens, setContradictionLens] = useState(false);
  const activeEvidence = useMemo(() => detail.evidence.filter((item) => !item.excluded && item.review_state !== 'superseded'), [detail.evidence]);
  const activeClusters = useMemo(() => detail.clusters.filter((item) => item.review_state !== 'superseded'), [detail.clusters]);
  const evidenceToCluster = useMemo(() => {
    const result = new Map<string, string>();
    for (const cluster of activeClusters) for (const evidenceId of cluster.evidence_item_ids) result.set(evidenceId, cluster.id);
    return result;
  }, [activeClusters]);

  const visibleEvidence = useMemo(() => {
    if (!focused || !focusClusterId) return activeEvidence;
    const cluster = activeClusters.find((item) => item.id === focusClusterId);
    const ids = new Set(cluster?.evidence_item_ids ?? []);
    return activeEvidence.filter((item) => ids.has(item.id));
  }, [activeClusters, activeEvidence, focusClusterId, focused]);

  const visibleClusters = useMemo(() => focused && focusClusterId ? activeClusters.filter((item) => item.id === focusClusterId) : activeClusters, [activeClusters, focusClusterId, focused]);
  const visibleIds = useMemo(() => new Set(visibleEvidence.map((item) => item.id)), [visibleEvidence]);
  const visibleOpportunities = useMemo(() => focused && focusClusterId
    ? detail.opportunities.filter((item) => item.evidence_item_ids.some((id) => visibleIds.has(id)))
    : detail.opportunities,
  [detail.opportunities, focusClusterId, focused, visibleIds]);

  const traceOpportunity = useMemo(
    () => visibleOpportunities.find((item) => item.id === selectedOpportunityId) ?? null,
    [selectedOpportunityId, visibleOpportunities],
  );
  const traceEvidenceIds = useMemo(() => new Set(traceOpportunity?.evidence_item_ids ?? []), [traceOpportunity]);
  const traceFragmentIds = useMemo(() => new Set(
    visibleEvidence
      .filter((item) => traceEvidenceIds.has(item.id))
      .flatMap((item) => item.source_fragment_ids),
  ), [traceEvidenceIds, visibleEvidence]);
  const traceSourceIds = useMemo(() => new Set(
    detail.fragments
      .filter((fragment) => traceFragmentIds.has(fragment.id))
      .map((fragment) => fragment.source_document_id),
  ), [detail.fragments, traceFragmentIds]);
  const activeContradictions = useMemo(() => traceOpportunity
    ? detail.contradictions.filter((item) => item.opportunity_id === traceOpportunity.id || item.evidence_item_ids.some((id) => traceEvidenceIds.has(id)))
    : [],
  [detail.contradictions, traceEvidenceIds, traceOpportunity]);
  const traceContradictions = activeContradictions.length;
  const contradictionEvidenceIds = useMemo(() => new Set(activeContradictions.flatMap((item) => item.evidence_item_ids)), [activeContradictions]);

  const positions = useMemo(() => {
    const centers = new Map<string, { x: number; y: number }>();
    const columns = Math.max(1, Math.ceil(Math.sqrt(visibleClusters.length)));
    visibleClusters.forEach((cluster, index) => centers.set(cluster.id, { x: 260 + (index % columns) * 520, y: 210 + Math.floor(index / columns) * 390 }));
    const points: Point[] = visibleEvidence.map((item, index) => ({
      id: item.id,
      clusterId: evidenceToCluster.get(item.id) ?? 'unclustered',
      x: 260 + Math.cos(index * 1.618) * 90,
      y: 210 + Math.sin(index * 1.618) * 70,
    }));
    const simulation = forceSimulation(points)
      .force('x', forceX<Point>((point) => centers.get(point.clusterId)?.x ?? 260).strength(0.32))
      .force('y', forceY<Point>((point) => centers.get(point.clusterId)?.y ?? 210).strength(0.32))
      .force('collision', forceCollide<Point>(focused ? 95 : 82).strength(0.9))
      .stop();
    const ticks = Math.min(80, 28 + Math.ceil(Math.log2(Math.max(2, points.length))) * 8);
    for (let index = 0; index < ticks; index += 1) simulation.tick();
    return { centers, points: new Map(points.map((point) => [point.id, { x: point.x ?? 0, y: point.y ?? 0 }])) };
  }, [evidenceToCluster, focused, visibleClusters, visibleEvidence]);

  const nodes = useMemo<Node[]>(() => {
    const clusterNodes: Node[] = visibleClusters.map((cluster) => {
      const center = positions.centers.get(cluster.id) ?? { x: 200, y: 180 };
      const count = cluster.evidence_item_ids.filter((id) => visibleIds.has(id)).length;
      const width = Math.min(360, 184 + Math.sqrt(count) * 42);
      const height = Math.min(260, 116 + Math.sqrt(count) * 34);
      const traceHit = traceOpportunity ? cluster.evidence_item_ids.some((id) => traceEvidenceIds.has(id)) : false;
      return {
        id: `cluster:${cluster.id}`,
        position: { x: center.x - width / 2 + 70, y: center.y - height / 2 + 40 },
        data: { label: <ClusterCanopy label={cluster.label} count={count} /> },
        className: `cluster-canopy-node ${traceOpportunity ? (traceHit ? 'trace-active' : 'trace-muted') : ''}`,
        style: { width, height, zIndex: -1 },
        draggable: false, selectable: false, focusable: false,
      };
    });
    const evidenceNodes: Node[] = visibleEvidence.map((item) => ({
      id: `evidence:${item.id}`,
      position: positions.points.get(item.id) ?? { x: 200, y: 200 },
      data: { label: <EvidenceNode title={item.title} kind={item.kind} reviewState={item.review_state} selected={selectedEvidenceId === item.id} /> },
      className: `field-node evidence-map-node ${traceOpportunity ? (traceEvidenceIds.has(item.id) ? 'trace-active' : 'trace-muted') : ''} ${contradictionLens && contradictionEvidenceIds.has(item.id) ? 'contradiction-active' : contradictionLens && traceOpportunity ? 'contradiction-muted' : ''}`,
      style: { width: focused ? 244 : 214 },
    }));
    const opportunityNodes: Node[] = visibleOpportunities.map((item, index) => ({
      id: `opportunity:${item.id}`,
      position: { x: 760 + (index % 3) * 330, y: 80 + Math.floor(index / 3) * 220 },
      data: { label: <OpportunityNode title={item.title} selected={selectedOpportunityId === item.id} /> },
      className: `field-node opportunity-map-node ${traceOpportunity ? (traceOpportunity.id === item.id ? 'trace-active' : 'trace-muted') : ''}`, style: { width: 250 },
    }));
    return [...clusterNodes, ...evidenceNodes, ...opportunityNodes];
  }, [contradictionEvidenceIds, contradictionLens, focused, positions.centers, positions.points, selectedEvidenceId, selectedOpportunityId, traceEvidenceIds, traceOpportunity, visibleClusters, visibleEvidence, visibleIds, visibleOpportunities]);

  const edges = useMemo<Edge[]>(() => visibleOpportunities.flatMap((opportunity) => opportunity.evidence_item_ids
    .filter((id) => visibleIds.has(id))
    .map((evidenceId) => ({
      id: `edge:${evidenceId}:${opportunity.id}`,
      source: `evidence:${evidenceId}`,
      target: `opportunity:${opportunity.id}`,
      animated: !lowPower,
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
      className: `ink-edge ${traceOpportunity ? (opportunity.id === traceOpportunity.id ? 'trace-active' : 'trace-muted') : ''}`,
    }))), [lowPower, traceOpportunity, visibleIds, visibleOpportunities]);

  return <div className={`flow-field ${focused ? 'focused-flow' : ''}`} aria-label="Evidence map">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      fitViewOptions={{ padding: focused ? 0.22 : 0.12, duration: lowPower ? 0 : 350 }}
      minZoom={focused ? 0.65 : 0.35}
      maxZoom={1.6}
      onlyRenderVisibleElements
      zoomOnPinch={!focused}
      zoomOnDoubleClick={false}
      panOnScroll={!focused}
      nodesDraggable={!focused}
      onNodeClick={(_, node) => {
        if (node.id.startsWith('evidence:')) onEvidenceSelect(node.id.slice('evidence:'.length));
        if (node.id.startsWith('opportunity:')) onOpportunitySelect(node.id.slice('opportunity:'.length));
      }}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#d7d0bf" gap={28} size={1} />
      {!focused ? <Controls showInteractive={false} position="bottom-left" /> : null}
      {!lowPower && !focused && nodes.length < 250 ? <MiniMap position="bottom-right" pannable zoomable nodeStrokeWidth={2} /> : null}
    </ReactFlow>
    {traceOpportunity ? <aside className="map-trace-hud" aria-live="polite">
      <div className="map-trace-title"><GitBranch size={14} /><span>TRACE FIELD / LIVE PROVENANCE FOCUS</span>{onClearOpportunity ? <button type="button" onClick={onClearOpportunity} aria-label="Exit provenance trace"><X size={13} /></button> : null}</div>
      <strong>{traceOpportunity.title}</strong>
      <p>{contradictionLens ? 'Counter-evidence is isolated inside the same persisted provenance graph. Nothing is removed; supporting evidence is temporarily de-emphasized.' : 'Unrelated nodes are muted. Every illuminated evidence card contributes directly to this persisted opportunity.'}</p>
      <div className="map-trace-stats"><span><b>{traceEvidenceIds.size}</b> linked evidence</span><span><b>{traceFragmentIds.size}</b> exact fragments</span><span><b>{traceSourceIds.size}</b> sources</span><span className={traceContradictions ? 'has-conflict' : ''}><b>{traceContradictions}</b> contradictions</span></div>
      {traceContradictions ? <button type="button" className={`contradiction-lens-toggle ${contradictionLens ? 'active' : ''}`} onClick={() => setContradictionLens((value) => !value)}><TriangleAlert size={12} /> {contradictionLens ? 'Return to full provenance' : 'Isolate counter-evidence'}</button> : null}
      {contradictionLens ? <div className="contradiction-notes">{activeContradictions.map((item) => <p key={item.id}>{item.note}</p>)}</div> : null}
    </aside> : null}
    <div className="map-legend"><span><i className="legend-source" />evidence</span><span><i className="legend-insight" />opportunity</span></div>
  </div>;
}
