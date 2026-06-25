import { useMemo, useReducer, type ReactNode } from 'react';
import { initialWorkspaceUiState, WorkspaceUiContext, workspaceUiReducer, type WorkspaceView } from './workspace-context';

export function WorkspaceUiProvider({ children, initialView = 'list' }: { children: ReactNode; initialView?: WorkspaceView }) {
  const [state, dispatch] = useReducer(workspaceUiReducer, { ...initialWorkspaceUiState, view: initialView });
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <WorkspaceUiContext.Provider value={value}>{children}</WorkspaceUiContext.Provider>;
}
