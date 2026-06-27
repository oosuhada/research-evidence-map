import { AlertTriangle, LoaderCircle, Sprout } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

export function LoadingState({ label }: { label?: string }) {
  const { text } = useLocale();
  return <div className="route-state" role="status"><LoaderCircle className="spin" /><h2>{label ?? text('Loading research field…', '리서치 필드 불러오는 중…')}</h2><p>{text('The canvas will remain available when the workspace is ready.', '워크스페이스가 준비되면 캔버스를 계속 사용할 수 있습니다.')}</p></div>;
}

export function ErrorState({ title, detail, retry }: { title?: string; detail: string; retry?: () => void }) {
  const { text } = useLocale();
  return <div className="route-state route-error" role="alert"><AlertTriangle /><h2>{title ?? text('The research field could not be loaded.', '리서치 필드를 불러오지 못했습니다.')}</h2><p>{detail}</p>{retry ? <button className="outline-button" onClick={retry}>{text('Try again', '다시 시도')}</button> : null}</div>;
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="route-state"><Sprout /><h2>{title}</h2><p>{detail}</p>{action}</div>;
}
