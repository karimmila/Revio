import { ipcRenderer } from 'electron'

export type TurnCheckpointApi = {
  save: (args: { worktreePath: string; sessionId: string }) => Promise<string | null>
  restore: (args: { worktreePath: string; sessionId: string; before: number }) => Promise<boolean>
}

export const turnCheckpointApi: TurnCheckpointApi = {
  save: (args) => ipcRenderer.invoke('turnCheckpoint:save', args),
  restore: (args) => ipcRenderer.invoke('turnCheckpoint:restore', args)
}
