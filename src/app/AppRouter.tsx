import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/RouteState';

const HomeRoute = lazy(() => import('../routes/HomeRoute').then((module) => ({ default: module.HomeRoute })));
const WorkspaceRoute = lazy(() => import('../routes/WorkspaceRoute').then((module) => ({ default: module.WorkspaceRoute })));
const ShareRoute = lazy(() => import('../routes/ShareRoute').then((module) => ({ default: module.ShareRoute })));

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Research Evidence Map render failure', error, info.componentStack); }
  render() {
    if (this.state.error) return <main className="garden-shell"><ErrorState detail={this.state.error.message} retry={() => this.setState({ error: null })} /></main>;
    return this.props.children;
  }
}

export function AppRouter() {
  return <AppErrorBoundary><BrowserRouter><Suspense fallback={<main className="garden-shell"><LoadingState /></main>}><Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/w/:workspaceId" element={<WorkspaceRoute />} />
      <Route path="/share/:token" element={<ShareRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense></BrowserRouter></AppErrorBoundary>;
}
