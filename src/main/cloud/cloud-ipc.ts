import { app, BrowserWindow, ipcMain } from 'electron'
import { z } from 'zod'
import type { CloudBuildEvent, CloudRepoState } from '../../shared/cloud/cloud-types'
import type { Repo } from '../../shared/repo-types'
import { cancelCloudBuild, startCloudBuild } from './cloud-build'
import { checkCloudBuild } from './cloud-build-check'
import { githubRepoOf } from './cloud-github'
import { reconcileCloudSessions } from './cloud-session-watch'
import { startCloudDesktop } from './cloud-desktop'
import { cloudSshCommand } from './cloud-ssh-command'
import { readPublicPorts, sharePortPublicly, stopSharingPort } from './cloud-public-ports'
import { applyNetworkToRunningWorkspaces } from './cloud-network-apply'
import { humanCloudError } from './cloud-errors'
import { reportCloudActivity } from './cloud-idle'
import { deleteOrphanSandbox, deleteUnusedSnapshot, readCloudInventory } from './cloud-inventory'
import { registerCloudMirrorHandlers } from './cloud-mirror-ipc'
import { prepareCloudRestore, retireCloudSandboxForArchive } from './cloud-archive-restore'
import { registerCloudGithubHandlers } from './cloud-github-ipc'
import { readCloudReadiness } from './cloud-readiness'
import { cloudSetupLaunchFor } from './cloud-setup-launch'
import { readBuildLog, readRepoFile, writeCloudRepoConfig } from './cloud-repo-store'
import {
  clearCloudClaudeToken,
  hasCloudClaudeToken,
  writeCloudClaudeToken
} from './cloud-claude-token'

export const CLOUD_BUILD_EVENT = 'cloud:buildEvent'

const ConfigSchema = z.object({
  installScript: z.string().max(100_000),
  setupScript: z.string().max(100_000),
  wakeScript: z.string().max(100_000),
  vcpus: z.number().int().min(1).max(32).nullable(),
  network: z.enum(['open', 'allowlist']).optional(),
  extraDomains: z.array(z.string().max(253)).max(100).optional()
})

const RestoreSchema = z.object({
  repoId: z.string().min(1).max(512),
  branch: z.string().min(1).max(1024),
  snapshotId: z
    .string()
    .regex(/^snap_\w{8,64}$/)
    .nullable(),
  commit: z.string().regex(/^[0-9a-f]{7,64}$/)
})

function broadcast(event: CloudBuildEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(CLOUD_BUILD_EVENT, event)
    }
  }
}

export function registerCloudHandlers(getRepos: () => Repo[]): void {
  registerCloudMirrorHandlers(getRepos)
  registerCloudGithubHandlers(getRepos)
  ipcMain.handle('cloud:readiness', () => readCloudReadiness(getRepos()))
  ipcMain.handle('cloud:setupLaunch', (_event, environmentId: unknown) =>
    typeof environmentId === 'string' && /^[\w-]{1,80}$/.test(environmentId)
      ? (cloudSetupLaunchFor(
          { executionHostId: `runtime:${environmentId}` },
          app.getPath('userData')
        ) ?? null)
      : null
  )
  const repoPath = (repoId: unknown): { id: string; path: string } => {
    const repo = getRepos().find((candidate) => candidate.id === repoId)
    if (!repo) {
      throw new Error('Unknown repository')
    }
    return { id: repo.id, path: repo.path }
  }
  ipcMain.handle('cloud:repoState', async (_event, repoId: unknown): Promise<CloudRepoState> => {
    const repo = repoPath(repoId)
    const file = readRepoFile(repo.id)
    return { ...file, github: await githubRepoOf(repo.path) }
  })
  ipcMain.handle('cloud:saveConfig', async (_event, repoId: unknown, config: unknown) => {
    const repo = repoPath(repoId)
    writeCloudRepoConfig(repo.id, ConfigSchema.parse(config))
    return applyNetworkToRunningWorkspaces(repo.id, repo.path).catch(() => 0)
  })
  ipcMain.handle('cloud:checkBuild', (_event, repoId: unknown) =>
    checkCloudBuild(repoPath(repoId).id)
  )
  ipcMain.handle('cloud:startBuild', (_event, repoId: unknown) => {
    const repo = repoPath(repoId)
    return startCloudBuild(repo.id, repo.path, broadcast)
  })
  ipcMain.handle('cloud:cancelBuild', (_event, repoId: unknown) => {
    cancelCloudBuild(repoPath(repoId).id)
  })
  ipcMain.handle('cloud:reportActivity', (_event, environmentIds: unknown) => {
    if (Array.isArray(environmentIds)) {
      reportCloudActivity(environmentIds.filter((id): id is string => typeof id === 'string'))
    }
  })
  ipcMain.handle('cloud:reconcileSessions', () =>
    reconcileCloudSessions(app.getPath('userData')).catch(() => [])
  )
  ipcMain.handle('cloud:startDesktop', (_event, environmentId: unknown) => {
    if (typeof environmentId !== 'string' || !environmentId) {
      throw new Error('Unknown cloud workspace')
    }
    return startCloudDesktop(app.getPath('userData'), environmentId).catch((error: unknown) => {
      throw new Error(humanCloudError(error))
    })
  })
  ipcMain.handle('cloud:sshCommand', (_event, environmentId: unknown) => {
    if (typeof environmentId !== 'string' || !environmentId) {
      throw new Error('Unknown cloud workspace')
    }
    return cloudSshCommand(app.getPath('userData'), environmentId)
  })
  const environmentIdOf = (environmentId: unknown): string => {
    if (typeof environmentId !== 'string' || !/^[\w-]{1,80}$/.test(environmentId)) {
      throw new Error('Unknown cloud workspace')
    }
    return environmentId
  }
  const humanly = (error: unknown): never => {
    throw new Error(humanCloudError(error))
  }
  ipcMain.handle('cloud:publicPorts', (_event, environmentId: unknown) =>
    readPublicPorts(app.getPath('userData'), environmentIdOf(environmentId)).catch(humanly)
  )
  ipcMain.handle('cloud:sharePort', (_event, environmentId: unknown, port: unknown) =>
    sharePortPublicly(app.getPath('userData'), environmentIdOf(environmentId), port).catch(humanly)
  )
  ipcMain.handle('cloud:unsharePort', (_event, environmentId: unknown, port: unknown) =>
    stopSharingPort(app.getPath('userData'), environmentIdOf(environmentId), port).catch(humanly)
  )
  ipcMain.handle('cloud:inventory', () =>
    readCloudInventory(app.getPath('userData')).catch((error: unknown) => {
      throw new Error(humanCloudError(error))
    })
  )
  ipcMain.handle('cloud:deleteSandbox', (_event, name: unknown) => {
    if (typeof name !== 'string' || !/^[\w-]{1,100}$/.test(name)) {
      throw new Error('Unknown sandbox')
    }
    return deleteOrphanSandbox(app.getPath('userData'), name)
  })
  ipcMain.handle('cloud:deleteSnapshot', (_event, snapshotId: unknown) => {
    if (typeof snapshotId !== 'string' || !/^snap_\w{8,64}$/.test(snapshotId)) {
      throw new Error('Unknown snapshot')
    }
    return deleteUnusedSnapshot(snapshotId)
  })
  ipcMain.handle('cloud:retireAsleepSandbox', (_event, runtimeId: unknown) => {
    if (typeof runtimeId !== 'string' || !/^[\w-]{1,128}$/.test(runtimeId)) {
      throw new Error('Unknown cloud workspace')
    }
    return retireCloudSandboxForArchive(app.getPath('userData'), runtimeId).catch(humanly)
  })
  ipcMain.handle('cloud:prepareRestore', (_event, args: unknown) => {
    prepareCloudRestore(RestoreSchema.parse(args))
  })
  ipcMain.handle('cloud:claudeTokenSet', () => hasCloudClaudeToken())
  ipcMain.handle('cloud:setClaudeToken', (_event, token: unknown) => {
    if (typeof token !== 'string') {
      throw new Error('Paste the token from claude setup-token.')
    }
    writeCloudClaudeToken(token)
  })
  ipcMain.handle('cloud:clearClaudeToken', () => clearCloudClaudeToken())
  ipcMain.handle('cloud:buildLog', (_event, buildId: unknown) =>
    typeof buildId === 'string' ? readBuildLog(buildId) : ''
  )
}
