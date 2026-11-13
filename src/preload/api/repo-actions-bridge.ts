import { ipcRenderer } from 'electron'
import type { ActionRunMode, RepoAction } from '../../shared/actions/repo-actions'
import type { SetupStatus } from '../../shared/setup-status'
import type { WorktreeIncludePreview } from '../../shared/worktree-include-preview'
import {
  REPO_ACTION_AGENT_REPLY_CHANNEL,
  REPO_ACTION_AGENT_REQUEST_CHANNEL,
  type RepoActionAgentReply,
  type RepoActionAgentRequest
} from '../../shared/actions/repo-action-agent-bridge'

export type RepoActionsApi = {
  list: (repoId: string) => Promise<{
    actions: RepoAction[]
    runMode: ActionRunMode
    previewUrls: string[]
    sharedFile: string
    sharedFileName: string
    sharedError: string | null
  }>
  save: (
    repoId: string,
    actions: RepoAction[],
    runMode?: ActionRunMode,
    previewUrls?: string[]
  ) => Promise<void>
  /** The script environment a Run action gets in this workspace (ports, paths, target branch). */
  scriptEnv: (repoId: string, worktreePath: string) => Promise<Record<string, string>>
  /** Setup run state per worktree path on this Mac, from the runner's status file. */
  setupStatus: (worktreePaths: string[]) => Promise<Record<string, SetupStatus | null>>
  /** Main polls these worktrees' setup once for all windows; returns what is known now. */
  setupWatch: (worktreePaths: string[]) => Promise<Record<string, SetupStatus | null>>
  onSetupStatusChanged: (
    listener: (event: { path: string; status: SetupStatus | null }) => void
  ) => () => void
  onSetupFinished: (
    listener: (event: { path: string; status: 'succeeded' | 'failed'; runId: string }) => void
  ) => () => void
  /** True for exactly one window per finished setup run; that window runs its follow-up. */
  claimSetupFinished: (path: string, runId: string) => Promise<boolean>
  /** The gitignored files a new workspace gets copied: `.worktreeinclude`, else these patterns. */
  filesToCopyPreview: (repoId: string, patterns: string[]) => Promise<WorktreeIncludePreview>
  /** The repository's git remotes, for Settings' Remote picker. */
  listRemotes: (repoId: string) => Promise<string[]>
  onChanged: (listener: (event: { repoId: string }) => void) => () => void
  /** Agents' `orca action` asks the window that shows the workspace to resolve or run an action. */
  onAgentRequest: (listener: (request: RepoActionAgentRequest) => void) => () => void
  replyAgentRequest: (reply: RepoActionAgentReply) => void
}

export const repoActionsApi: RepoActionsApi = {
  list: (repoId) => ipcRenderer.invoke('actions:list', repoId),
  save: (repoId, actions, runMode, previewUrls) =>
    ipcRenderer.invoke('actions:save', repoId, actions, runMode, previewUrls),
  scriptEnv: (repoId, worktreePath) =>
    ipcRenderer.invoke('actions:scriptEnv', repoId, worktreePath),
  listRemotes: (repoId) => ipcRenderer.invoke('repos:listRemotes', repoId),
  filesToCopyPreview: (repoId, patterns) =>
    ipcRenderer.invoke('repos:filesToCopyPreview', repoId, patterns),
  setupStatus: (worktreePaths) => ipcRenderer.invoke('setup:status', worktreePaths),
  setupWatch: (worktreePaths) => ipcRenderer.invoke('setup:watch', worktreePaths),
  onSetupStatusChanged: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: { path: string; status: SetupStatus | null }
    ): void => listener(payload)
    ipcRenderer.on('setup:status-changed', handler)
    return () => ipcRenderer.removeListener('setup:status-changed', handler)
  },
  onSetupFinished: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: { path: string; status: 'succeeded' | 'failed'; runId: string }
    ): void => listener(payload)
    ipcRenderer.on('setup:finished', handler)
    return () => ipcRenderer.removeListener('setup:finished', handler)
  },
  claimSetupFinished: (path, runId) => ipcRenderer.invoke('setup:claimFinished', path, runId),
  onChanged: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { repoId: string }): void =>
      listener(payload)
    ipcRenderer.on('actions:changed', handler)
    return () => ipcRenderer.removeListener('actions:changed', handler)
  },
  onAgentRequest: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, request: RepoActionAgentRequest): void =>
      listener(request)
    ipcRenderer.on(REPO_ACTION_AGENT_REQUEST_CHANNEL, handler)
    return () => ipcRenderer.removeListener(REPO_ACTION_AGENT_REQUEST_CHANNEL, handler)
  },
  replyAgentRequest: (reply) => ipcRenderer.send(REPO_ACTION_AGENT_REPLY_CHANNEL, reply)
}
