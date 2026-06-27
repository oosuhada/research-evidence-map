import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, FilePlus2, Files, ShieldAlert, Upload } from 'lucide-react';
import { ApiError, api } from '../../api/client';
import { useLocale } from '../../i18n/LocaleContext';
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
  const { text } = useLocale();
  const [documents, setDocuments] = useState<ImportDocument[]>([]);
  const [pasteName, setPasteName] = useState(() => text('Interview notes', '인터뷰 노트'));
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
        name: pasteName.trim() || text('Pasted notes', '붙여넣은 노트'),
        source_type: sourceType,
        participant: participant.trim() || null,
        channel: channel.trim() || null,
        created_date: createdDate ? new Date(`${createdDate}T12:00:00`).toISOString() : null,
        detected_encoding: 'utf-8',
        content: pasteText,
      });
    }
    return result;
  }, [channel, createdDate, documents, participant, pasteName, pasteText, sourceType, text]);

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
      setError(text('Paste text or choose at least one TXT, Markdown, CSV, or JSON file.', '텍스트를 붙여넣거나 TXT, Markdown, CSV, JSON 파일을 하나 이상 선택하세요.'));
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
      setError(cause instanceof Error ? cause.message : text('Import preview failed.', '가져오기 미리보기에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!preview) return;
    const hasSensitive = preview.documents.some((item) => item.sensitive_warning);
    if (hasSensitive && !ackSensitive) {
      setError(text('Acknowledge the sensitive-data warning before importing.', '가져오기 전에 민감정보 경고를 확인했다는 체크가 필요합니다.'));
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
      setError(cause instanceof ApiError ? cause.detail : cause instanceof Error ? cause.message : text('Import failed.', '가져오기에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return <section className="tool-panel import-panel" aria-labelledby="import-heading">
    <div className="panel-heading"><div><span>{text('STEP 02 / SOURCE INTAKE', 'STEP 02 / 원문 가져오기')}</span><h2 id="import-heading">{text('Import customer evidence', '고객 근거 자료 가져오기')}</h2></div><Upload size={22} /></div>
    <p className="panel-intro">{text('Uploads are previewed and fragmented first. Analysis never starts automatically.', '업로드한 자료는 먼저 미리보기와 fragment 분리를 거칩니다. 분석은 자동으로 시작되지 않습니다.')}</p>

    <div className="import-grid">
      <div className="paste-card">
        <label>{text('Document name', '문서 이름')}<input value={pasteName} onChange={(event) => { setPasteName(event.target.value); setPreview(null); }} /></label>
        <label>{text('Paste text', '텍스트 붙여넣기')}<textarea value={pasteText} onChange={(event) => { setPasteText(event.target.value); setPreview(null); }} rows={8} placeholder={text('Paste an interview, review, support thread, or meeting note…', '인터뷰, 리뷰, 고객지원 대화, 회의 노트를 붙여넣으세요…')} /></label>
        <div className="metadata-grid">
          <label>{text('Source type', '원문 유형')}<select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="interview">{text('Interview', '인터뷰')}</option><option value="app-review">{text('App review', '앱 리뷰')}</option><option value="support">{text('Support / CS', '고객지원 / CS')}</option><option value="meeting-note">{text('Meeting note', '회의 노트')}</option></select></label>
          <label>{text('Participant', '참여자')}<input value={participant} onChange={(event) => setParticipant(event.target.value)} placeholder="PM-03" /></label>
          <label>{text('Channel', '채널')}<input value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="Zoom / App Store" /></label>
          <label>{text('Created date', '작성일')}<input type="date" value={createdDate} onChange={(event) => setCreatedDate(event.target.value)} /></label>
        </div>
      </div>
      <label className="drop-card">
        <Files size={28} />
        <strong>{text('Batch import files', '파일 일괄 가져오기')}</strong>
        <span>TXT · Markdown · CSV · JSON</span>
        <input type="file" multiple accept=".txt,.md,.markdown,.csv,.json,text/plain,text/markdown,text/csv,application/json" onChange={(event) => void readFiles(event.target.files)} />
      </label>
    </div>

    {documents.length ? <div className="queued-files"><b>{text(`${documents.length} queued file${documents.length === 1 ? '' : 's'}`, `대기 중인 파일 ${documents.length}개`)}</b>{documents.map((document, index) => <button key={`${document.name}-${index}`} onClick={() => { setDocuments((current) => current.filter((_, itemIndex) => itemIndex !== index)); setPreview(null); }} aria-label={text(`Remove ${document.name}`, `${document.name} 제거`)}>{document.name} ×</button>)}</div> : null}

    {error ? <div className="inline-error" role="alert"><AlertTriangle size={16} />{error}</div> : null}

    {!preview ? <button className="ink-button compact" onClick={() => void makePreview()} disabled={busy || !preparedDocuments.length}><FilePlus2 size={15} />{busy ? text('Preparing preview…', '미리보기 준비 중…') : text(`Preview ${preparedDocuments.length || ''} source${preparedDocuments.length === 1 ? '' : 's'}`, `원문 ${preparedDocuments.length || ''}개 미리보기`)}</button> : (
      <div className="import-preview" data-testid="import-preview">
        <div className="preview-banner"><ShieldAlert size={18} /><div><b>{text('Preview only · analysis has not started', '미리보기 단계 · 분석은 아직 시작되지 않았습니다')}</b><span>{text(`Local retention: ${preview.retention_days} days by policy; you can delete sources or the entire workspace at any time.`, `로컬 보관 정책: ${preview.retention_days}일. 언제든 원문이나 전체 워크스페이스를 삭제할 수 있습니다.`)}</span></div></div>
        {preview.documents.map((item) => <article key={item.content_hash} className={item.duplicate ? 'is-duplicate' : ''}>
          <div><span>{item.source_type}</span><h3>{item.name}</h3><p>{item.participant || item.channel || text('No participant/channel metadata', '참여자/채널 메타데이터 없음')} · {item.detected_encoding}</p></div>
          <div className="preview-flags"><b>{text(`${item.fragment_count} fragments`, `fragment ${item.fragment_count}개`)}</b>{item.duplicate ? <em>{text('DUPLICATE', '중복')}</em> : null}{item.sensitive_warning ? <em className="sensitive">{text('SENSITIVE DATA?', '민감정보?')}</em> : null}</div>
          <blockquote>{item.fragment_preview[0] || text('No fragment preview', 'fragment 미리보기 없음')}</blockquote>
        </article>)}
        {preview.documents.some((item) => item.sensitive_warning) ? <label className="sensitive-ack"><input type="checkbox" checked={ackSensitive} onChange={(event) => setAckSensitive(event.target.checked)} />{text('I reviewed the warning and want to import this data into this local workspace.', '경고 내용을 확인했으며 이 데이터를 로컬 워크스페이스로 가져오는 데 동의합니다.')}</label> : null}
        <div className="panel-actions"><button className="outline-button" onClick={() => setPreview(null)} disabled={busy}>{text('Back to intake', '입력으로 돌아가기')}</button><button className="ink-button compact" onClick={() => void commit()} disabled={busy || preview.documents.every((item) => item.duplicate)}>{busy ? text('Importing…', '가져오는 중…') : text('Confirm import', '가져오기 확정')}</button></div>
      </div>
    )}
  </section>;
}
