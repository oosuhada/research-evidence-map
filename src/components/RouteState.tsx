import { AlertTriangle, LoaderCircle, Sprout } from 'lucide-react';

export function LoadingState({ label = 'Loading research field…' }: { label?: string }) {
  return <div className="route-state" role="status"><LoaderCircle className="spin" /><h2>{label}</h2><p>The canvas will remain available when the workspace is ready.</p></div>;
}

export function ErrorState({ title = 'The research field could not be loaded.', detail, retry }: { title?: string; detail: string; retry?: () => void }) {
  return <div className="route-state route-error" role="alert"><AlertTriangle /><h2>{title}</h2><p>{detail}</p>{retry ? <button className="outline-button" onClick={retry}>Try again</button> : null}</div>;
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="route-state"><Sprout /><h2>{title}</h2><p>{detail}</p>{action}</div>;
}
