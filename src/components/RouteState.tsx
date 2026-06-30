import { AlertTriangle, CheckCircle2, FileText, GitCommitHorizontal, SearchCheck, Sprout } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

export function LoadingState({ label, fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  const { text } = useLocale();
  return <div className={`route-state route-loading ${fullScreen ? 'route-loading-full' : 'route-loading-inline'}`} role="status" aria-live="polite">
    <div className="loading-scene">
      <div className="loading-orbit" aria-hidden="true">
        <div className="loading-orbit-ring ring-one" />
        <div className="loading-orbit-ring ring-two" />
        <i className="loading-orbit-signal signal-one" />
        <i className="loading-orbit-signal signal-two" />
        <div className="loading-core"><SearchCheck size={22} /><span>{text('VERIFY', '검증')}</span></div>
        <div className="loading-orbit-node orbit-source"><FileText size={15} /><span>01</span><b>{text('SOURCE', '원문')}</b></div>
        <div className="loading-orbit-node orbit-evidence"><CheckCircle2 size={15} /><span>02</span><b>{text('EVIDENCE', '근거')}</b></div>
        <div className="loading-orbit-node orbit-decision"><GitCommitHorizontal size={15} /><span>03</span><b>{text('DECISION', '결정')}</b></div>
      </div>
      <div className="loading-copy">
        <span>{text('TRACEABLE RESEARCH WORKSPACE', '추적 가능한 리서치 워크스페이스')}</span>
        <h2>{label ?? text('Loading research field…', '리서치 필드 불러오는 중…')}</h2>
        <p>{text('Reconstructing the path from source material to a human decision.', '원문에서 근거를 거쳐 사람의 결정까지 이어지는 경로를 다시 구성하고 있습니다.')}</p>
        <div className="loading-steps" aria-hidden="true"><span>{text('SOURCE', '원문')}</span><i /><span>{text('VERIFY', '검증')}</span><i /><span>{text('DECIDE', '결정')}</span></div>
        <div className="loading-progress" aria-hidden="true"><i /></div>
      </div>
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
