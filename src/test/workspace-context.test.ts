import { describe, expect, it } from 'vitest';
import { initialWorkspaceUiState, workspaceUiReducer } from '../state/workspace-context';

describe('workspace typed reducer', () => {
  it('selects evidence and clusters without global browser events', () => {
    let state = workspaceUiReducer(initialWorkspaceUiState, { type: 'toggle-evidence', id: 'e1' });
    state = workspaceUiReducer(state, { type: 'toggle-cluster', id: 'c1' });
    expect(state.selectedEvidenceIds).toEqual(['e1']);
    expect(state.selectedClusterIds).toEqual(['c1']);
    expect(workspaceUiReducer(state, { type: 'set-view', view: 'map' }).view).toBe('map');
  });
});
