import { app, ipcMain } from 'electron'
import { listEphemeralVmRuntimes } from '../../shared/ephemeral-vm-runtime-store'
import { getEphemeralVmRecipeResultConnection } from '../../shared/ephemeral-vm-recipes'
import { VERCEL_CLOUD_RECIPE_ID } from '../../shared/cloud/cloud-recipe'
import type { CloudMirrorStatus, CloudMirrorInfo } from '../../shared/cloud/cloud-types'
import type { Repo } from '../../shared/repo-types'
import { syncCloudMirror } from './cloud-mirror'
import type { SandboxTarget } from './cloud-mirror-remote'
import { readMirrorState, writeMirrorState } from './cloud-mirror-state'

function cloudRuntime(environmentId: unknown) {
  if (typeof environmentId !== 'string' || !environmentId) {
    throw new Error('Unknown cloud workspace')
  }
  const runtime = listEphemeralVmRuntimes(app.getPath('userData')).find(
    (entry) =>
      entry.recipeId === VERCEL_CLOUD_RECIPE_ID &&
      entry.runtimeEnvironmentId === environmentId &&
      entry.status !== 'cleaned'
  )
  if (!runtime) {
    throw new Error('This workspace has no cloud sandbox.')
  }
  return runtime
}

export function registerCloudMirrorHandlers(getRepos: () => Repo[]): void {
  ipcMain.handle('cloud:mirrorInfo', (_event, environmentId: unknown): CloudMirrorInfo => {
    const record = readMirrorState()[cloudRuntime(environmentId).id]
    return {
      repoId: record?.repoId || null,
      enabled: record?.enabled ?? false,
      mirrorPath: record?.mirrorPath || null,
      lastSyncedAt: record?.lastSyncedAt ?? null,
      error: record?.lastError ?? null
    }
  })
  ipcMain.handle('cloud:mirrorSetEnabled', (_event, environmentId: unknown, enabled: unknown) => {
    const runtime = cloudRuntime(environmentId)
    const record = readMirrorState()[runtime.id]
    writeMirrorState(runtime.id, {
      repoId: record?.repoId ?? runtime.repoId ?? '',
      repoPath: record?.repoPath ?? '',
      mirrorPath: record?.mirrorPath ?? '',
      branch: record?.branch ?? '',
      createdBranch: record?.createdBranch ?? false,
      lastSyncedAt: record?.lastSyncedAt ?? null,
      lastError: record?.lastError ?? null,
      enabled: enabled === true
    })
  })
  ipcMain.handle('cloud:mirrorSync', (_event, environmentId: unknown) => {
    const runtime = cloudRuntime(environmentId)
    if (runtime.status !== 'running') {
      // The renderer syncs every 30 s while the workspace is open; a sleeping one is skipped
      // quietly (throwing logged one IPC error per pass, ~50k lines over a night).
      return Promise.resolve({
        state: 'never',
        mirrorPath: null,
        lastSyncedAt: null,
        error: 'Open the workspace first; its sandbox is asleep.',
        files: 0,
        deleted: 0,
        skippedLinks: 0,
        skippedLarge: 0
      } satisfies CloudMirrorStatus)
    }
    const repo = getRepos().find((candidate) => candidate.id === runtime.repoId)
    const connection = runtime.recipeResult
      ? getEphemeralVmRecipeResultConnection(runtime.recipeResult)
      : null
    if (!repo || connection?.type !== 'ssh' || !connection.target.identityFile) {
      throw new Error('This cloud workspace has no SSH connection on record.')
    }
    const target: SandboxTarget = {
      runtimeId: runtime.id,
      host: connection.target.host,
      username: connection.target.username,
      identityFile: connection.target.identityFile,
      proxyCommand: connection.target.proxyCommand ?? '',
      projectRoot: connection.projectRoot
    }
    return syncCloudMirror({
      repoId: repo.id,
      repoPath: repo.path,
      workspaceName: runtime.workspaceName ?? runtime.id,
      target
    })
  })
}
