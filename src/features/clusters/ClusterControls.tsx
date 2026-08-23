import { useMemo, useState } from 'react';
import { GitMerge, Plus, Scissors } from 'lucide-react';
import { api } from '../../api/client';
import type { WorkspaceDetail } from '../../schemas/domain';
import { useWorkspaceUi } from '../../state/workspace-context';

type Props = { workspaceId: string; detail: WorkspaceDetail; onChanged: () => Promise<void> };

export function ClusterControls({ workspaceId, detail, onChanged }: Props) {
  const { state, dispatch } = useWorkspaceUi();
  const activeClusters = useMemo(() => detail.clusters.filter((item) => item.review_state !== 'superseded'), [detail.clusters]);
  const [newLabel, setNewLabel] = useState('');
  const [mergeLabel, setMergeLabel] = useState('');
  const [splitClusterId, setSplitClusterId] = useState('');
  const [groupALabel, setGroupALabel] = useState('Theme A');
  const [groupBLabel, setGroupBLabel] = useState('Theme B');
  const [groupAIds, setGroupAIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const splitCluster = activeClusters.find((item) => item.id === splitClusterId);

  const mutate = async (operation: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await operation(); await onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Cluster action failed.'); }
    finally { setBusy(false); }
  };

  const create = () => mutate(async () => {
    if (!newLabel.trim() || !state.selectedEvidenceIds.length) throw new Error('Select evidence and name the new cluster first.');
    await api.createCluster(workspaceId, newLabel.trim(), state.selectedEvidenceIds);
    setNewLabel(''); dispatch({ type: 'clear-evidence' });
  });

  const merge = () => mutate(async () => {
    if (state.selectedClusterIds.length < 2) throw new Error('Select at least two clusters to merge.');
    if (!mergeLabel.trim()) throw new Error('Give the merged cluster a label.');
    await api.mergeClusters(workspaceId, state.selectedClusterIds, mergeLabel.trim());
    setMergeLabel(''); dispatch({ type: 'clear-clusters' });
  });

  const split = () => mutate(async () => {
    if (!splitCluster || splitCluster.evidence_item_ids.length < 2) throw new Error('Choose a cluster containing at least two evidence items.');
    const groupA = groupAIds.filter((id) => splitCluster.evidence_item_ids.includes(id));
    const groupB = splitCluster.evidence_item_ids.filter((id) => !groupA.includes(id));
    if (!groupA.length || !groupB.length) throw new Error('Place at least one evidence item in each split group.');
    await api.splitCluster(workspaceId, splitCluster.id, [
      { label: groupALabel.trim() || 'Theme A', evidence_item_ids: groupA },
      { label: groupBLabel.trim() || 'Theme B', evidence_item_ids: groupB },
    ]);
    setSplitClusterId(''); setGroupAIds([]);
  });

  return <section className="tool-panel cluster-panel" aria-labelledby="cluster-tools-heading">
    <div className="panel-heading"><div><span>STEP 04 / HUMAN SYNTHESIS</span><h2 id="cluster-tools-heading">Cluster workshop</h2></div><GitMerge size={20} /></div>
    <div className="cluster-list" role="group" aria-label="Select clusters to merge">
      {activeClusters.map((cluster) => <label key={cluster.id}><input type="checkbox" checked={state.selectedClusterIds.includes(cluster.id)} onChange={() => dispatch({ type: 'toggle-cluster', id: cluster.id })} /><span><b>{cluster.label}</b><small>{cluster.evidence_item_ids.length} signals · {cluster.review_state}</small></span></label>)}
    </div>
    <div className="cluster-action-grid">
      <form onSubmit={(event) => { event.preventDefault(); void create(); }}><b><Plus size={14} /> New cluster from selected evidence</b><input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Cluster label" /><button disabled={busy || !state.selectedEvidenceIds.length}>Create ({state.selectedEvidenceIds.length})</button></form>
      <form onSubmit={(event) => { event.preventDefault(); void merge(); }}><b><GitMerge size={14} /> Merge selected clusters</b><input value={mergeLabel} onChange={(event) => setMergeLabel(event.target.value)} placeholder="Merged label" /><button disabled={busy || state.selectedClusterIds.length < 2}>Merge ({state.selectedClusterIds.length})</button></form>
    </div>
    <div className="split-workbench">
      <div className="split-heading"><b><Scissors size={14} /> Split one cluster</b><select aria-label="Cluster to split" value={splitClusterId} onChange={(event) => { setSplitClusterId(event.target.value); setGroupAIds([]); }}><option value="">Choose cluster…</option>{activeClusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.label}</option>)}</select></div>
      {splitCluster ? <div className="split-groups"><div><input value={groupALabel} onChange={(event) => setGroupALabel(event.target.value)} aria-label="First split label" />{splitCluster.evidence_item_ids.map((id) => { const evidence = detail.evidence.find((item) => item.id === id); return <label key={id}><input type="checkbox" checked={groupAIds.includes(id)} onChange={() => setGroupAIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />{evidence?.title ?? id}</label>; })}</div><div><input value={groupBLabel} onChange={(event) => setGroupBLabel(event.target.value)} aria-label="Second split label" /><p>Unchecked evidence moves here.</p>{splitCluster.evidence_item_ids.filter((id) => !groupAIds.includes(id)).map((id) => <span key={id}>{detail.evidence.find((item) => item.id === id)?.title ?? id}</span>)}</div><button className="outline-button" onClick={() => void split()} disabled={busy}>Apply split</button></div> : null}
    </div>
    {error ? <p className="inline-error" role="alert">{error}</p> : null}
  </section>;
}
