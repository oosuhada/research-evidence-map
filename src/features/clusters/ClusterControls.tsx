import { useMemo, useState } from 'react';
import { GitMerge, Plus, Scissors } from 'lucide-react';
import { api } from '../../api/client';
import { useLocale } from '../../i18n/LocaleContext';
import type { WorkspaceDetail } from '../../schemas/domain';
import { useWorkspaceUi } from '../../state/workspace-context';

type Props = { workspaceId: string; detail: WorkspaceDetail; onChanged: () => Promise<void> };

export function ClusterControls({ workspaceId, detail, onChanged }: Props) {
  const { text } = useLocale();
  const { state, dispatch } = useWorkspaceUi();
  const activeClusters = useMemo(() => detail.clusters.filter((item) => item.review_state !== 'superseded'), [detail.clusters]);
  const [newLabel, setNewLabel] = useState('');
  const [mergeLabel, setMergeLabel] = useState('');
  const [splitClusterId, setSplitClusterId] = useState('');
  const [groupALabel, setGroupALabel] = useState(() => text('Theme A', '테마 A'));
  const [groupBLabel, setGroupBLabel] = useState(() => text('Theme B', '테마 B'));
  const [groupAIds, setGroupAIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const splitCluster = activeClusters.find((item) => item.id === splitClusterId);

  const mutate = async (operation: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await operation(); await onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : text('Cluster action failed.', '클러스터 작업에 실패했습니다.')); }
    finally { setBusy(false); }
  };

  const create = () => mutate(async () => {
    if (!newLabel.trim() || !state.selectedEvidenceIds.length) throw new Error(text('Select evidence and name the new cluster first.', '근거를 선택하고 새 클러스터 이름을 입력하세요.'));
    await api.createCluster(workspaceId, newLabel.trim(), state.selectedEvidenceIds);
    setNewLabel(''); dispatch({ type: 'clear-evidence' });
  });

  const merge = () => mutate(async () => {
    if (state.selectedClusterIds.length < 2) throw new Error(text('Select at least two clusters to merge.', '합칠 클러스터를 두 개 이상 선택하세요.'));
    if (!mergeLabel.trim()) throw new Error(text('Give the merged cluster a label.', '합친 클러스터의 이름을 입력하세요.'));
    await api.mergeClusters(workspaceId, state.selectedClusterIds, mergeLabel.trim());
    setMergeLabel(''); dispatch({ type: 'clear-clusters' });
  });

  const split = () => mutate(async () => {
    if (!splitCluster || splitCluster.evidence_item_ids.length < 2) throw new Error(text('Choose a cluster containing at least two evidence items.', '근거가 두 개 이상 들어 있는 클러스터를 선택하세요.'));
    const groupA = groupAIds.filter((id) => splitCluster.evidence_item_ids.includes(id));
    const groupB = splitCluster.evidence_item_ids.filter((id) => !groupA.includes(id));
    if (!groupA.length || !groupB.length) throw new Error(text('Place at least one evidence item in each split group.', '나눌 두 그룹에 각각 근거를 하나 이상 배치하세요.'));
    await api.splitCluster(workspaceId, splitCluster.id, [
      { label: groupALabel.trim() || text('Theme A', '테마 A'), evidence_item_ids: groupA },
      { label: groupBLabel.trim() || text('Theme B', '테마 B'), evidence_item_ids: groupB },
    ]);
    setSplitClusterId(''); setGroupAIds([]);
  });

  return <section className="tool-panel cluster-panel" aria-labelledby="cluster-tools-heading">
    <div className="panel-heading"><div><span>{text('STEP 04 / HUMAN SYNTHESIS', 'STEP 04 / 사람의 종합')}</span><h2 id="cluster-tools-heading">{text('Cluster workshop', '클러스터 워크샵')}</h2></div><GitMerge size={20} /></div>
    <div className="cluster-list" role="group" aria-label={text('Select clusters to merge', '합칠 클러스터 선택')}>
      {activeClusters.map((cluster) => <label key={cluster.id}><input type="checkbox" checked={state.selectedClusterIds.includes(cluster.id)} onChange={() => dispatch({ type: 'toggle-cluster', id: cluster.id })} /><span><b>{cluster.label}</b><small>{text(`${cluster.evidence_item_ids.length} signals · ${cluster.review_state}`, `근거 ${cluster.evidence_item_ids.length}개 · ${cluster.review_state}`)}</small></span></label>)}
    </div>
    <div className="cluster-action-grid">
      <form onSubmit={(event) => { event.preventDefault(); void create(); }}><b><Plus size={14} /> {text('New cluster from selected evidence', '선택한 근거로 새 클러스터 만들기')}</b><input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder={text('Cluster label', '클러스터 이름')} /><button disabled={busy || !state.selectedEvidenceIds.length}>{text(`Create (${state.selectedEvidenceIds.length})`, `생성 (${state.selectedEvidenceIds.length})`)}</button></form>
      <form onSubmit={(event) => { event.preventDefault(); void merge(); }}><b><GitMerge size={14} /> {text('Merge selected clusters', '선택한 클러스터 합치기')}</b><input value={mergeLabel} onChange={(event) => setMergeLabel(event.target.value)} placeholder={text('Merged label', '합친 클러스터 이름')} /><button disabled={busy || state.selectedClusterIds.length < 2}>{text(`Merge (${state.selectedClusterIds.length})`, `합치기 (${state.selectedClusterIds.length})`)}</button></form>
    </div>
    <div className="split-workbench">
      <div className="split-heading"><b><Scissors size={14} /> {text('Split one cluster', '클러스터 나누기')}</b><select aria-label={text('Cluster to split', '나눌 클러스터')} value={splitClusterId} onChange={(event) => { setSplitClusterId(event.target.value); setGroupAIds([]); }}><option value="">{text('Choose cluster…', '클러스터 선택…')}</option>{activeClusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.label}</option>)}</select></div>
      {splitCluster ? <div className="split-groups"><div><input value={groupALabel} onChange={(event) => setGroupALabel(event.target.value)} aria-label={text('First split label', '첫 번째 그룹 이름')} />{splitCluster.evidence_item_ids.map((id) => { const evidence = detail.evidence.find((item) => item.id === id); return <label key={id}><input type="checkbox" checked={groupAIds.includes(id)} onChange={() => setGroupAIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />{evidence?.title ?? id}</label>; })}</div><div><input value={groupBLabel} onChange={(event) => setGroupBLabel(event.target.value)} aria-label={text('Second split label', '두 번째 그룹 이름')} /><p>{text('Unchecked evidence moves here.', '체크하지 않은 근거는 이쪽으로 이동합니다.')}</p>{splitCluster.evidence_item_ids.filter((id) => !groupAIds.includes(id)).map((id) => <span key={id}>{detail.evidence.find((item) => item.id === id)?.title ?? id}</span>)}</div><button className="outline-button" onClick={() => void split()} disabled={busy}>{text('Apply split', '나누기 적용')}</button></div> : null}
    </div>
    {error ? <p className="inline-error" role="alert">{error}</p> : null}
  </section>;
}
