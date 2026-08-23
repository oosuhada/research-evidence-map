import type { WorkspaceDetail } from '../../schemas/domain';

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char] ?? char));
}

export function buildMapSvg(detail: WorkspaceDetail) {
  const evidence = detail.evidence.filter((item) => !item.excluded && item.review_state !== 'superseded');
  const clusters = detail.clusters.filter((item) => item.review_state !== 'superseded');
  const width = 1400;
  const rowHeight = 120;
  const height = Math.max(720, 180 + Math.ceil(evidence.length / 4) * rowHeight);
  const clusterLabel = new Map<string, string>();
  for (const cluster of clusters) for (const id of cluster.evidence_item_ids) clusterLabel.set(id, cluster.label);
  const cards = evidence.map((item, index) => {
    const x = 70 + (index % 4) * 325;
    const y = 150 + Math.floor(index / 4) * rowHeight;
    const title = escapeXml(item.title.slice(0, 42));
    const label = escapeXml(clusterLabel.get(item.id) ?? 'Unclustered');
    return `<g transform="translate(${x} ${y})"><rect width="285" height="88" fill="#f7f3e9" stroke="#8e8878"/><text x="14" y="20" font-family="monospace" font-size="10" fill="#68705f">${escapeXml(item.review_state.toUpperCase())} · ${label}</text><text x="14" y="46" font-family="serif" font-size="17" fill="#20261f">${title}</text><text x="14" y="68" font-family="sans-serif" font-size="10" fill="#666459">${escapeXml(item.kind)}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f1ede2"/><text x="70" y="62" font-family="serif" font-size="34" fill="#20261f">${escapeXml(detail.workspace.name)} / Signal Garden</text><text x="70" y="92" font-family="monospace" font-size="12" fill="#68675e">TRACEABLE EVIDENCE MAP · ${evidence.length} EVIDENCE · ${clusters.length} CLUSTERS</text>${cards}</svg>`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSvg(detail: WorkspaceDetail) {
  downloadBlob(new Blob([buildMapSvg(detail)], { type: 'image/svg+xml;charset=utf-8' }), `signal-garden-${detail.workspace.id.slice(0, 8)}-map.svg`);
}

export async function exportPng(detail: WorkspaceDetail) {
  const svg = buildMapSvg(detail);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas export is unavailable in this browser.');
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG encoding failed.');
    downloadBlob(blob, `signal-garden-${detail.workspace.id.slice(0, 8)}-map.png`);
  } finally { URL.revokeObjectURL(url); }
}
