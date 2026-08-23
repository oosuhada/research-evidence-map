import { useState } from 'react';
import { Download, Link2, Share2, Unlink } from 'lucide-react';
import { api } from '../../api/client';
import type { WorkspaceDetail } from '../../schemas/domain';
import { exportPng, exportSvg } from './map-export';

type Props = { workspaceId: string; detail: WorkspaceDetail; onChanged: () => Promise<void> };

export function ExportPanel({ workspaceId, detail, onChanged }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createShare = async () => {
    setBusy(true); setError(null);
    try {
      const filterJson = Object.fromEntries(new URLSearchParams(window.location.search).entries());
      const link = await api.createShare(workspaceId, filterJson);
      const shareUrl = `${window.location.origin}/share/${link.token}${window.location.search}`;
      try { await navigator.clipboard.writeText(shareUrl); setMessage(`Read-only link copied: ${shareUrl}`); }
      catch { setMessage(shareUrl); }
      await onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create share link.'); }
    finally { setBusy(false); }
  };

  const revoke = async (shareId: string) => {
    setBusy(true); setError(null);
    try { await api.revokeShare(workspaceId, shareId); await onChanged(); setMessage('Share link revoked.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not revoke share link.'); }
    finally { setBusy(false); }
  };

  return <section className="tool-panel export-panel" aria-labelledby="export-heading">
    <div className="panel-heading"><div><span>STEP 07 / DELIVER</span><h2 id="export-heading">Share & export</h2></div><Share2 size={20} /></div>
    <div className="export-grid"><a href={api.exportUrl(workspaceId, 'report.md')} download><Download size={15} />Markdown opportunity brief</a><a href={api.exportUrl(workspaceId, 'evidence.csv')} download><Download size={15} />CSV evidence + locators</a><button onClick={() => exportSvg(detail)}><Download size={15} />SVG map</button><button onClick={() => void exportPng(detail).catch((cause) => setError(cause instanceof Error ? cause.message : 'PNG export failed.'))}><Download size={15} />PNG map</button></div>
    <button className="ink-button compact" onClick={() => void createShare()} disabled={busy}><Link2 size={14} />Create read-only link with current view</button>
    {detail.shares.length ? <div className="share-list">{detail.shares.map((share) => <div key={share.id}><span>{share.revoked ? 'REVOKED' : 'ACTIVE'} · /share/{share.token.slice(0, 8)}…</span>{!share.revoked ? <button onClick={() => void revoke(share.id)} disabled={busy}><Unlink size={13} />Revoke</button> : null}</div>)}</div> : null}
    {message ? <p className="share-message" role="status">{message}</p> : null}
    {error ? <p className="inline-error" role="alert">{error}</p> : null}
  </section>;
}
