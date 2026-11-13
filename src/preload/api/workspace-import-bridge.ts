import { ipcRenderer } from 'electron'
import type {
  WorkspaceImportDetection,
  WorkspaceImportOptions,
  WorkspaceImportPreparation,
  WorkspaceImportProgress,
  WorkspaceImportResult
} from '../../shared/workspace-import-types'
import type {
  AsleepCloudWakeChanges,
  AsleepCloudWorkspace
} from '../../shared/asleep-cloud-workspace-types'

export type WorkspaceImportApi = {
  /** Whether the other app's data is on this Mac at all; cheap, unlike detect. */
  available: () => Promise<boolean>
  /** Reads only the other app's own data folder, never a repository or workspace folder. */
  detect: () => Promise<WorkspaceImportDetection>
  /** Reads the repositories' scripts; call it only once the person has pressed Import. */
  prepare: () => Promise<WorkspaceImportPreparation>
  run: (options: WorkspaceImportOptions) => Promise<WorkspaceImportResult>
  onProgress: (listener: (progress: WorkspaceImportProgress) => void) => () => void
  /** Imported cloud workspaces with no sandbox yet; each wakes when opened. */
  asleepList: () => Promise<AsleepCloudWorkspace[]>
  prepareWake: (id: string) => Promise<AsleepCloudWorkspace>
  /** Null while the sandbox has not taken the workspace's files; the record then stays. */
  finishWake: (id: string) => Promise<AsleepCloudWakeChanges | null>
  onAsleepChanged: (listener: () => void) => () => void
}

export const workspaceImportApi: WorkspaceImportApi = {
  available: () => ipcRenderer.invoke('workspaceImport:available'),
  detect: () => ipcRenderer.invoke('workspaceImport:detect'),
  prepare: () => ipcRenderer.invoke('workspaceImport:prepare'),
  run: (options) => ipcRenderer.invoke('workspaceImport:run', options),
  onProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: WorkspaceImportProgress): void =>
      listener(progress)
    ipcRenderer.on('workspaceImport:progress', handler)
    return () => ipcRenderer.removeListener('workspaceImport:progress', handler)
  },
  asleepList: () => ipcRenderer.invoke('workspaceImport:asleepList'),
  prepareWake: (id) => ipcRenderer.invoke('workspaceImport:prepareWake', id),
  finishWake: (id) => ipcRenderer.invoke('workspaceImport:finishWake', id),
  onAsleepChanged: (listener) => {
    const handler = (): void => listener()
    ipcRenderer.on('workspaceImport:asleepChanged', handler)
    return () => ipcRenderer.removeListener('workspaceImport:asleepChanged', handler)
  }
}
