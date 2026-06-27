import { useState } from 'react';
import { Download, Link2, Share2, Unlink } from 'lucide-react';
import { api } from '../../api/client';
import { useLocale } from '../../i18n/LocaleContext';
import type { WorkspaceDetail } from '../../schemas/domain';
import { exportPng, exportSvg } from './map-export';

type Props = { workspaceId: string; detail: WorkspaceDetail; onChanged: () => Promise<void> };

export function ExportPanel({ workspaceId, detail, onChanged }: Props) {
  const { text } = useLocale();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createShare = async () => {
    setBusy(true); setError(null);
    try {
      const filterJson = Object.fromEntries(new URLSearchParams(window.location.search).entries());
      const link = await api.createShare(workspaceId, filterJson);
      const shareUrl = `${window.location.origin}/share/${link.token}${window.location.search}`;
      try { await navigator.clipboard.writeText(shareUrl); setMessage(text(`Read-only link copied: ${shareUrl}`, `읽기 전용 링크를 복사했습니다: ${shareUrl}`)); }
      catch { setMessage(shareUrl); }
      await onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : text('Could not create share link.', '공유 링크를 만들지 못했습니다.')); }
    finally { setBusy(false); }
  };

  const revoke = async (shareId: string) => {
    setBusy(true); setError(null);
    try { await api.revokeShare(workspaceId, shareId); await onChanged(); setMessage(text('Share link revoked.', '공유 링크를 해제했습니다.')); }
    catch (cause) { setError(cause instanceof Error ? cause.message : text('Could not revoke share link.', '공유 링크를 해제하지 못했습니다.')); }
    finally { setBusy(false); }
  };

  return <section className="tool-panel export-panel" aria-labelledby="export-heading">
    <div className="panel-heading"><div><span>{text('STEP 09 / DELIVER', 'STEP 09 / 공유·내보내기')}</span><h2 id="export-heading">{text('Share & export', '공유 & 내보내기')}</h2></div><Share2 size={20} /></div>
    <div className="export-grid"><a href={api.exportUrl(workspaceId, 'report.md')} download><Download size={15} />{text('Markdown opportunity brief', 'Markdown 기회 브리프')}</a><a href={api.exportUrl(workspaceId, 'evidence.csv')} download><Download size={15} />{text('CSV evidence + locators', 'CSV 근거 + 위치 정보')}</a><button onClick={() => exportSvg(detail)}><Download size={15} />SVG {text('map', '맵')}</button><button onClick={() => void exportPng(detail).catch((cause) => setError(cause instanceof Error ? cause.message : text('PNG export failed.', 'PNG 내보내기에 실패했습니다.')))}><Download size={15} />PNG {text('map', '맵')}</button></div>
    <button className="ink-button compact" onClick={() => void createShare()} disabled={busy}><Link2 size={14} />{text('Create read-only link with current view', '현재 화면의 읽기 전용 링크 만들기')}</button>
    {detail.shares.length ? <div className="share-list">{detail.shares.map((share) => <div key={share.id}><span>{share.revoked ? text('REVOKED', '해제됨') : text('ACTIVE', '활성')} · /share/{share.token.slice(0, 8)}…</span>{!share.revoked ? <button onClick={() => void revoke(share.id)} disabled={busy}><Unlink size={13} />{text('Revoke', '해제')}</button> : null}</div>)}</div> : null}
    {message ? <p className="share-message" role="status">{message}</p> : null}
    {error ? <p className="inline-error" role="alert">{error}</p> : null}
  </section>;
}
