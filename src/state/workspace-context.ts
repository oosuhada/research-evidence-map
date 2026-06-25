import { createContext, useContext, type Dispatch } from 'react';

export type WorkspaceView = 'list' | 'map';

export type WorkspaceUiState = {
  view: WorkspaceView;
  selectedEvidenceIds: string[];
  selectedClusterIds: string[];
  busyAction: string | null;
};

export type WorkspaceUiAction =
  | { type: 'set-view'; view: WorkspaceView }
  | { type: 'toggle-evidence'; id: string }
  | { type: 'clear-evidence' }
  | { type: 'toggle-cluster'; id: string }
  | { type: 'clear-clusters' }
  | { type: 'busy'; action: string | null };

export const initialWorkspaceUiState: WorkspaceUiState = { view: 'list', selectedEvidenceIds: [], selectedClusterIds: [], busyAction: null };

export function workspaceUiReducer(state: WorkspaceUiState, action: WorkspaceUiAction): WorkspaceUiState {
  switch (action.type) {
    case 'set-view': return { ...state, view: action.view };
    case 'toggle-evidence': return {
      ...state,
      selectedEvidenceIds: state.selectedEvidenceIds.includes(action.id)
        ? state.selectedEvidenceIds.filter((id) => id !== action.id)
        : [...state.selectedEvidenceIds, action.id],
    };
    case 'clear-evidence': return { ...state, selectedEvidenceIds: [] };
    case 'toggle-cluster': return {
      ...state,
      selectedClusterIds: state.selectedClusterIds.includes(action.id)
        ? state.selectedClusterIds.filter((id) => id !== action.id)
        : [...state.selectedClusterIds, action.id],
    };
    case 'clear-clusters': return { ...state, selectedClusterIds: [] };
    case 'busy': return { ...state, busyAction: action.action };
  }
}

export const WorkspaceUiContext = createContext<{ state: WorkspaceUiState; dispatch: Dispatch<WorkspaceUiAction> } | null>(null);

export function useWorkspaceUi() {
  const value = useContext(WorkspaceUiContext);
  if (!value) throw new Error('useWorkspaceUi must be used inside WorkspaceUiProvider');
  return value;
}
