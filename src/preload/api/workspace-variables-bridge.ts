import { ipcRenderer } from 'electron'
import type {
  WorkspaceVariable,
  WorkspaceVariablesScope
} from '../../shared/workspace-variables/dotenv'
import type { WorktreeEnvScanResult } from '../../shared/workspace-variables/worktree-env-scan'

export type WorkspaceVariablesApi = {
  read: (scope: WorkspaceVariablesScope) => Promise<WorkspaceVariable[]>
  write: (scope: WorkspaceVariablesScope, variables: WorkspaceVariable[]) => Promise<void>
  openFile: (scope: WorkspaceVariablesScope) => Promise<void>
  scanWorktrees: (repoId: string) => Promise<WorktreeEnvScanResult>
}

export const workspaceVariablesApi: WorkspaceVariablesApi = {
  read: (scope) => ipcRenderer.invoke('workspaceVariables:read', scope),
  write: (scope, variables) => ipcRenderer.invoke('workspaceVariables:write', scope, variables),
  openFile: (scope) => ipcRenderer.invoke('workspaceVariables:openFile', scope),
  scanWorktrees: (repoId) => ipcRenderer.invoke('workspaceVariables:scanWorktrees', repoId)
}
