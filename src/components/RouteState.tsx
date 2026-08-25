import { AlertTriangle, Sprout } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

export function LoadingState({ label }: { label?: string }) {
  const { text } = useLocale();
  return <div className="route-state route-loading" role="status" aria-live="polite">
    <div className="loading-trace" aria-hidden="true">
      <div className="loading-trace-line" />
      <div className="loading-trace-node node-source"><span>01</span><b>{text('SOURCE', '원문')}</b></div>
      <div className="loading-trace-node node-evidence"><span>02</span><b>{text('EVIDENCE', '근거')}</b></div>
      <div className="loading-trace-node node-decision"><span>03</span><b>{text('DECISION', '결정')}</b></div>
      <i className="loading-trace-pulse pulse-one" />
      <i className="loading-trace-pulse pulse-two" />
    </div>
    <div className="loading-copy">
      <span>{text('TRACEABLE RESEARCH WORKSPACE', '추적 가능한 리서치 워크스페이스')}</span>
      <h2>{label ?? text('Loading research field…', '리서치 필드 불러오는 중…')}</h2>
      <p>{text('Connecting sources, evidence, and the human decision trail.', '원문과 근거, 사람의 의사결정 경로를 연결하고 있습니다.')}</p>
      <div className="loading-progress" aria-hidden="true"><i /></div>
    </div>
  </div>;
}

export function ErrorState({ title, detail, retry }: { title?: string; detail: string; retry?: () => void }) {
  const { text } = useLocale();
  return <div className="route-state route-error" role="alert"><AlertTriangle /><h2>{title ?? text('The research field could not be loaded.', '리서치 필드를 불러오지 못했습니다.')}</h2><p>{detail}</p>{retry ? <button className="outline-button" onClick={retry}>{text('Try again', '다시 시도')}</button> : null}</div>;
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="route-state"><Sprout /><h2>{title}</h2><p>{detail}</p>{action}</div>;
}
