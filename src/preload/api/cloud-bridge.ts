import { ipcRenderer } from 'electron'
import type { WorktreeSetupLaunch } from '../../shared/worktree/launch-types'
import type {
  CloudBuild,
  CloudInventory,
  CloudMirrorInfo,
  CloudMirrorStatus,
  CloudPublicPort,
  CloudPublicPorts,
  CloudBuildEvent,
  CloudGithubEvent,
  CloudGithubSignIn,
  CloudGithubStatus,
  CloudRepoConfig,
  CloudRepoReadiness,
  CloudRepoState
} from '../../shared/cloud/cloud-types'
import type { GithubAppOverride } from '../../shared/cloud/github-app-config'

export type CloudApi = {
  repoState: (repoId: string) => Promise<CloudRepoState>
  /** Returns how many running cloud workspaces took a new Network setting at once. */
  saveConfig: (repoId: string, config: CloudRepoConfig) => Promise<number>
  startBuild: (repoId: string) => Promise<CloudBuild>
  /** One Vercel lookup: whether the build snapshot new workspaces start from is still there. */
  checkBuild: (repoId: string) => Promise<'ready' | 'missing' | 'expired'>
  cancelBuild: (repoId: string) => Promise<void>
  buildLog: (buildId: string) => Promise<string>
  /** Records sandboxes Vercel stopped on its own as suspended; returns their runtime ids. */
  reconcileSessions: () => Promise<string[]>
  /** The open cloud workspace and those with a working agent: none of them may idle-sleep. */
  reportActivity: (environmentIds: string[]) => Promise<void>
  /** Starts the sandbox desktop (VNC, Chrome, noVNC on 127.0.0.1) and names the SSH host to tunnel it. */
  startDesktop: (environmentId: string) => Promise<{
    sshTargetId: string
    remotePort: number
    suggestedLocalPort: number
    /** The VNC password for this desktop; main keeps it in memory only. */
    password: string
  }>
  /** The ssh command line that reaches the running sandbox, for the person's own terminal. */
  sshCommand: (environmentId: string) => Promise<string>
  /** Ports Vercel serves publicly for this sandbox, and its other TCP listeners. */
  publicPorts: (environmentId: string) => Promise<CloudPublicPorts>
  /** Gives the port a public Vercel address; only on the person's own confirmed request. */
  sharePort: (environmentId: string, port: number) => Promise<CloudPublicPort>
  /** Drops the port's Vercel route and checks that it is gone. */
  unsharePort: (environmentId: string, port: number) => Promise<void>
  mirrorInfo: (environmentId: string) => Promise<CloudMirrorInfo>
  mirrorSetEnabled: (environmentId: string, enabled: boolean) => Promise<void>
  /** One-way copy of the sandbox's files into the workspace's mirror on this Mac. */
  mirrorSync: (environmentId: string) => Promise<CloudMirrorStatus>
  inventory: () => Promise<CloudInventory>
  deleteSandbox: (name: string) => Promise<void>
  deleteSnapshot: (snapshotId: string) => Promise<void>
  /** Archives an asleep workspace's sandbox without waking it; returns the snapshot kept to restore it. */
  retireAsleepSandbox: (runtimeId: string) => Promise<{ restoreSnapshotId: string | null }>
  /** Marks the next cloud create of this repository and branch as a restore from that snapshot. */
  prepareRestore: (args: {
    repoId: string
    branch: string
    snapshotId: string | null
    commit: string
  }) => Promise<void>
  claudeTokenSet: () => Promise<boolean>
  setClaudeToken: (token: string) => Promise<void>
  clearClaudeToken: () => Promise<void>
  onBuildEvent: (listener: (event: CloudBuildEvent) => void) => () => void
  /** This Mac's GitHub repositories and whether each can get a cloud workspace now. */
  readiness: () => Promise<CloudRepoReadiness[]>
  /** The "Setup" terminal launch for a new cloud workspace on this environment, if it has one. */
  setupLaunch: (environmentId: string) => Promise<WorktreeSetupLaunch | null>
  githubStatus: () => Promise<CloudGithubStatus>
  /** Starts the GitHub App device flow; the result arrives as a GitHub event. */
  githubSignIn: () => Promise<CloudGithubSignIn>
  /** Opens GitHub's code-entry page for the sign-in in progress. */
  githubOpenVerification: () => Promise<void>
  githubCancelSignIn: () => Promise<void>
  /** Forgets the tokens on this Mac; GitHub's authorization stays until revoked there. */
  githubSignOut: () => Promise<void>
  /** Opens the app's install page for an owner and re-checks coverage when Orca regains focus. */
  githubInstall: (owner: string) => Promise<void>
  githubRecheck: () => Promise<void>
  githubDismissNotice: () => Promise<void>
  githubAppOverride: () => Promise<GithubAppOverride>
  /** Saves a custom GitHub App (blank fields use the built-in one); rejects invalid input. */
  githubSetAppOverride: (override: GithubAppOverride) => Promise<GithubAppOverride>
  onGithubEvent: (listener: (event: CloudGithubEvent) => void) => () => void
}

export const cloudApi: CloudApi = {
  repoState: (repoId) => ipcRenderer.invoke('cloud:repoState', repoId),
  saveConfig: (repoId, config) => ipcRenderer.invoke('cloud:saveConfig', repoId, config),
  startBuild: (repoId) => ipcRenderer.invoke('cloud:startBuild', repoId),
  checkBuild: (repoId) => ipcRenderer.invoke('cloud:checkBuild', repoId),
  cancelBuild: (repoId) => ipcRenderer.invoke('cloud:cancelBuild', repoId),
  buildLog: (buildId) => ipcRenderer.invoke('cloud:buildLog', buildId),
  reconcileSessions: () => ipcRenderer.invoke('cloud:reconcileSessions'),
  reportActivity: (environmentIds) => ipcRenderer.invoke('cloud:reportActivity', environmentIds),
  startDesktop: (environmentId) => ipcRenderer.invoke('cloud:startDesktop', environmentId),
  sshCommand: (environmentId) => ipcRenderer.invoke('cloud:sshCommand', environmentId),
  publicPorts: (environmentId) => ipcRenderer.invoke('cloud:publicPorts', environmentId),
  sharePort: (environmentId, port) => ipcRenderer.invoke('cloud:sharePort', environmentId, port),
  unsharePort: (environmentId, port) =>
    ipcRenderer.invoke('cloud:unsharePort', environmentId, port),
  mirrorInfo: (environmentId) => ipcRenderer.invoke('cloud:mirrorInfo', environmentId),
  mirrorSetEnabled: (environmentId, enabled) =>
    ipcRenderer.invoke('cloud:mirrorSetEnabled', environmentId, enabled),
  mirrorSync: (environmentId) => ipcRenderer.invoke('cloud:mirrorSync', environmentId),
  inventory: () => ipcRenderer.invoke('cloud:inventory'),
  deleteSandbox: (name) => ipcRenderer.invoke('cloud:deleteSandbox', name),
  deleteSnapshot: (snapshotId) => ipcRenderer.invoke('cloud:deleteSnapshot', snapshotId),
  retireAsleepSandbox: (runtimeId) => ipcRenderer.invoke('cloud:retireAsleepSandbox', runtimeId),
  prepareRestore: (args) => ipcRenderer.invoke('cloud:prepareRestore', args),
  claudeTokenSet: () => ipcRenderer.invoke('cloud:claudeTokenSet'),
  setClaudeToken: (token) => ipcRenderer.invoke('cloud:setClaudeToken', token),
  clearClaudeToken: () => ipcRenderer.invoke('cloud:clearClaudeToken'),
  onBuildEvent: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: CloudBuildEvent): void =>
      listener(payload)
    ipcRenderer.on('cloud:buildEvent', handler)
    return () => ipcRenderer.removeListener('cloud:buildEvent', handler)
  },
  readiness: () => ipcRenderer.invoke('cloud:readiness'),
  setupLaunch: (environmentId) => ipcRenderer.invoke('cloud:setupLaunch', environmentId),
  githubStatus: () => ipcRenderer.invoke('cloud:githubStatus'),
  githubSignIn: () => ipcRenderer.invoke('cloud:githubSignIn'),
  githubOpenVerification: () => ipcRenderer.invoke('cloud:githubOpenVerification'),
  githubCancelSignIn: () => ipcRenderer.invoke('cloud:githubCancelSignIn'),
  githubSignOut: () => ipcRenderer.invoke('cloud:githubSignOut'),
  githubInstall: (owner) => ipcRenderer.invoke('cloud:githubInstall', owner),
  githubRecheck: () => ipcRenderer.invoke('cloud:githubRecheck'),
  githubDismissNotice: () => ipcRenderer.invoke('cloud:githubDismissNotice'),
  githubAppOverride: () => ipcRenderer.invoke('cloud:githubAppOverride'),
  githubSetAppOverride: (override) => ipcRenderer.invoke('cloud:githubSetAppOverride', override),
  onGithubEvent: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: CloudGithubEvent): void =>
      listener(payload)
    ipcRenderer.on('cloud:githubChanged', handler)
    return () => ipcRenderer.removeListener('cloud:githubChanged', handler)
  }
}
