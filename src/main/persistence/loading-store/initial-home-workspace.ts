import { homedir } from 'node:os'
import { createInitialFolderWorkspaceState } from '../../../shared/initial-folder-workspace-state'
import type { PersistedState } from '../../../shared/persisted-state-types'
import { createLocalProjectRecord } from '../../workspaces/catalog/local-project-record'

export function createInitialHomeWorkspaceState(state: PersistedState): PersistedState {
  // The workspace layout opens on Home with no project; a seeded "~" would expose the whole home folder.
  if (state.settings.revioLayout === true) {
    return state
  }
  const home = createLocalProjectRecord({ path: homedir(), kind: 'folder', displayName: '~' })
  return createInitialFolderWorkspaceState(state, home)
}
