import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, FilePlus2, Files, ShieldAlert, Upload } from 'lucide-react';
import { ApiError, api } from '../../api/client';
import type { ImportDocument, ImportPreview, WorkspaceDetail } from '../../schemas/domain';

type Props = {
  workspaceId: string;
  onImported: (detail: WorkspaceDetail) => void;
};

function inferSourceType(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('review')) return 'app-review';
  if (lower.includes('support') || lower.includes('ticket') || lower.includes('cs')) return 'support';
  if (lower.includes('meeting') || lower.includes('minutes')) return 'meeting-note';
  return 'interview';
}

export function ImportPanel({ workspaceId, onImported }: Props) {
  const [documents, setDocuments] = useState<ImportDocument[]>([]);
  const [pasteName, setPasteName] = useState('Interview notes');
  const [pasteText, setPasteText] = useState('');
  const [sourceType, setSourceType] = useState('interview');
  const [participant, setParticipant] = useState('');
  const [channel, setChannel] = useState('');
  const [createdDate, setCreatedDate] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [ackSensitive, setAckSensitive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const preparedDocuments = useMemo(() => {
    const result = [...documents];
    if (pasteText.trim()) {
      result.unshift({
        name: pasteName.trim() || 'Pasted notes',
        source_type: sourceType,
        participant: participant.trim() || null,
        channel: channel.trim() || null,
        created_date: createdDate ? new Date(`${createdDate}T12:00:00`).toISOString() : null,
        detected_encoding: 'utf-8',
        content: pasteText,
      });
    }
    return result;
  }, [channel, createdDate, documents, participant, pasteName, pasteText, sourceType]);

  const readFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setPreview(null);
    setError(null);
    const read = await Promise.all([...files].map(async (file) => ({
      name: file.name,
      source_type: inferSourceType(file.name),
      participant: null,
      channel: null,
      created_date: file.lastModified ? new Date(file.lastModified).toISOString() : null,
      detected_encoding: 'utf-8',
      content: await file.text(),
    })));
    setDocuments((current) => [...current, ...read]);
  };

  const makePreview = async () => {
    if (!preparedDocuments.length) {
      setError('Paste text or choose at least one TXT, Markdown, CSV, or JSON file.');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      const next = await api.previewImport(workspaceId, preparedDocuments, controller.signal);
      setPreview(next);
      setAckSensitive(false);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'Import preview failed.');
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!preview) return;
    const hasSensitive = preview.documents.some((item) => item.sensitive_warning);
    if (hasSensitive && !ackSensitive) {
      setError('Acknowledge the sensitive-data warning before importing.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const detail = await api.commitImport(workspaceId, preparedDocuments, ackSensitive);
      onImported(detail);
      setDocuments([]);
      setPasteText('');
      setPreview(null);
      setAckSensitive(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.detail : cause instanceof Error ? cause.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="tool-panel import-panel" aria-labelledby="import-heading">
    <div className="panel-heading"><div><span>STEP 02 / SOURCE INTAKE</span><h2 id="import-heading">Import customer evidence</h2></div><Upload size={22} /></div>
    <p className="panel-intro">Uploads are previewed and fragmented first. Analysis never starts automatically.</p>

    <div className="import-grid">
      <div className="paste-card">
        <label>Document name<input value={pasteName} onChange={(event) => { setPasteName(event.target.value); setPreview(null); }} /></label>
        <label>Paste text<textarea value={pasteText} onChange={(event) => { setPasteText(event.target.value); setPreview(null); }} rows={8} placeholder="Paste an interview, review, support thread, or meeting note…" /></label>
        <div className="metadata-grid">
          <label>Source type<select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="interview">Interview</option><option value="app-review">App review</option><option value="support">Support / CS</option><option value="meeting-note">Meeting note</option></select></label>
          <label>Participant<input value={participant} onChange={(event) => setParticipant(event.target.value)} placeholder="PM-03" /></label>
          <label>Channel<input value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="Zoom / App Store" /></label>
          <label>Created date<input type="date" value={createdDate} onChange={(event) => setCreatedDate(event.target.value)} /></label>
        </div>
      </div>
      <label className="drop-card">
        <Files size={28} />
        <strong>Batch import files</strong>
        <span>TXT · Markdown · CSV · JSON</span>
        <input type="file" multiple accept=".txt,.md,.markdown,.csv,.json,text/plain,text/markdown,text/csv,application/json" onChange={(event) => void readFiles(event.target.files)} />
      </label>
    </div>

    {documents.length ? <div className="queued-files"><b>{documents.length} queued file{documents.length === 1 ? '' : 's'}</b>{documents.map((document, index) => <button key={`${document.name}-${index}`} onClick={() => { setDocuments((current) => current.filter((_, itemIndex) => itemIndex !== index)); setPreview(null); }} aria-label={`Remove ${document.name}`}>{document.name} ×</button>)}</div> : null}

    {error ? <div className="inline-error" role="alert"><AlertTriangle size={16} />{error}</div> : null}

    {!preview ? <button className="ink-button compact" onClick={() => void makePreview()} disabled={busy || !preparedDocuments.length}><FilePlus2 size={15} />{busy ? 'Preparing preview…' : `Preview ${preparedDocuments.length || ''} source${preparedDocuments.length === 1 ? '' : 's'}`}</button> : (
      <div className="import-preview" data-testid="import-preview">
        <div className="preview-banner"><ShieldAlert size={18} /><div><b>Preview only · analysis has not started</b><span>Local retention: {preview.retention_days} days by policy; you can delete sources or the entire workspace at any time.</span></div></div>
        {preview.documents.map((item) => <article key={item.content_hash} className={item.duplicate ? 'is-duplicate' : ''}>
          <div><span>{item.source_type}</span><h3>{item.name}</h3><p>{item.participant || item.channel || 'No participant/channel metadata'} · {item.detected_encoding}</p></div>
          <div className="preview-flags"><b>{item.fragment_count} fragments</b>{item.duplicate ? <em>DUPLICATE</em> : null}{item.sensitive_warning ? <em className="sensitive">SENSITIVE DATA?</em> : null}</div>
          <blockquote>{item.fragment_preview[0] || 'No fragment preview'}</blockquote>
        </article>)}
        {preview.documents.some((item) => item.sensitive_warning) ? <label className="sensitive-ack"><input type="checkbox" checked={ackSensitive} onChange={(event) => setAckSensitive(event.target.checked)} />I reviewed the warning and want to import this data into this local workspace.</label> : null}
        <div className="panel-actions"><button className="outline-button" onClick={() => setPreview(null)} disabled={busy}>Back to intake</button><button className="ink-button compact" onClick={() => void commit()} disabled={busy || preview.documents.every((item) => item.duplicate)}>{busy ? 'Importing…' : 'Confirm import'}</button></div>
      </div>
    )}
  </section>;
}
