import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type FakeSandbox = Record<string, unknown>

type MockState = {
  dir: string
  runtimes: unknown[]
  reads: FakeSandbox[]
  getError: unknown
  calls: string[]
}

const h = vi.hoisted((): MockState => ({
  dir: '',
  runtimes: [],
  reads: [],
  getError: null,
  calls: []
}))

vi.mock('./cloud-repo-store', () => ({ cloudDataRoot: () => h.dir }))
vi.mock('../vercel-cloud/vercel-cloud-auth', () => ({
  vercelScope: async () => ({ token: 't', teamId: 'team', projectId: 'prj' })
}))
vi.mock('../../shared/ephemeral-vm-runtime-store', () => ({
  listEphemeralVmRuntimes: () => h.runtimes
}))
vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    get: async () => {
      if (h.getError) {
        throw h.getError
      }
      const next = h.reads.shift()
      if (!next) {
        throw new Error('unexpected Sandbox.get')
      }
      return next
    }
  },
  Snapshot: {
    get: async ({ snapshotId }: { snapshotId: string }) => ({
      delete: async () => {
        h.calls.push(`delete-snapshot:${snapshotId}`)
      }
    })
  }
}))

import { VERCEL_CLOUD_RECIPE_ID } from '../../shared/cloud/cloud-recipe'
import { readArchivedWorkspaces } from '../revio/revio-archive-store'
import { archiveCloudRuntimeBeforeDestroy, runtimeArchiveRecord } from './cloud-destroy-guard'
import { recordRestorePoint, restorePointIds } from './cloud-restore-points'
import { retireSandbox } from './cloud-sandbox-retire'

const settle = { pollMs: 1, sleep: async () => {} }

function runtime(status: string, userData: Record<string, unknown> = {}) {
  return {
    id: 'orca-rt-1',
    recipeId: VERCEL_CLOUD_RECIPE_ID,
    repoId: 'mac-repo',
    projectId: 'github:me/repo',
    workspaceId: 'vm-repo::/vercel/repo',
    workspaceName: 'hey-just-create-env',
    status,
    cleanupStatus: 'not_started',
    createdAt: 1,
    updatedAt: 1,
    recipeResult: {
      userData: {
        sandboxName: 'revio-rt-1',
        branch: 'hey-just-create-env',
        startCommit: '082500a1338',
        ...userData
      }
    }
  }
}

function sandbox(status: string, snapshots = ['snap_stop00001']): FakeSandbox {
  return {
    name: 'revio-rt-1',
    status,
    currentSnapshotId: snapshots.at(-1),
    stop: async () => {
      h.calls.push('stop')
    },
    listSnapshots: async () => {
      const all = snapshots.map((id, index) => ({ id, status: 'created', createdAt: index }))
      // The SDK's paginator: `snapshots` is the first page only, `toArray` reads every page.
      return { snapshots: all.slice(0, 1), toArray: async () => all }
    },
    delete: async () => {
      h.calls.push('delete-sandbox')
    }
  }
}

describe('archiveCloudRuntimeBeforeDestroy', () => {
  beforeEach(() => {
    h.dir = mkdtempSync(join(tmpdir(), 'revio-guard-'))
    h.runtimes = [runtime('running')]
    h.reads = []
    h.getError = null
    h.calls = []
  })
  afterEach(() => {
    rmSync(h.dir, { recursive: true, force: true })
  })

  it('archives an awake workspace with a restore point before any destroy', async () => {
    h.reads = [sandbox('running', []), sandbox('stopped', ['snap_old00001', 'snap_stop00001'])]
    await archiveCloudRuntimeBeforeDestroy(h.dir, 'orca-rt-1', undefined, settle)
    expect(h.calls).toEqual(['stop', 'delete-snapshot:snap_old00001', 'delete-sandbox'])
    expect(restorePointIds()).toEqual(new Set(['snap_stop00001']))
    expect(readArchivedWorkspaces(h.dir)).toEqual([
      expect.objectContaining({
        id: 'vm-repo::/vercel/repo',
        repoId: 'mac-repo',
        displayName: 'hey-just-create-env',
        branch: 'hey-just-create-env',
        archiveCommit: '082500a1338',
        cloud: true,
        cloudRestore: { projectId: 'github:me/repo', snapshotId: 'snap_stop00001' }
      })
    ])
  })

  it('keeps the chats the window passed, so Unarchive brings them back', async () => {
    h.reads = [sandbox('running', []), sandbox('stopped', ['snap_stop00001'])]
    const chats = [{ agent: 'claude', sessionId: 'claude_1', providerSessionId: 'prov-1' }]
    await archiveCloudRuntimeBeforeDestroy(h.dir, 'orca-rt-1', undefined, settle, chats)
    expect(readArchivedWorkspaces(h.dir)).toEqual([expect.objectContaining({ chats })])
  })

  it('keeps an asleep workspace stop snapshot without waking it', async () => {
    h.runtimes = [runtime('suspended')]
    h.reads = [sandbox('stopped')]
    await archiveCloudRuntimeBeforeDestroy(h.dir, 'orca-rt-1', undefined, settle)
    expect(h.calls).toEqual(['delete-sandbox'])
    expect(readArchivedWorkspaces(h.dir)).toHaveLength(1)
  })

  it('refuses, deleting nothing, when Vercel cannot be reached (a dropped connection)', async () => {
    h.getError = new Error('fetch failed: socket hang up')
    await expect(
      archiveCloudRuntimeBeforeDestroy(h.dir, 'orca-rt-1', undefined, settle)
    ).rejects.toThrow(/socket hang up/)
    expect(h.calls).toEqual([])
    expect(readArchivedWorkspaces(h.dir)).toEqual([])
  })

  it('refuses, deleting nothing, when the stop left no snapshot', async () => {
    h.reads = [sandbox('running', []), sandbox('stopped', [])]
    await expect(
      archiveCloudRuntimeBeforeDestroy(h.dir, 'orca-rt-1', undefined, settle)
    ).rejects.toThrow(/no snapshot/)
    expect(h.calls).toEqual(['stop'])
  })

  it('needs nothing once the window archive already retired the sandbox', async () => {
    h.getError = Object.assign(new Error('Sandbox not found'), { response: { status: 404 } })
    await archiveCloudRuntimeBeforeDestroy(h.dir, 'orca-rt-1', undefined, settle)
    expect(h.calls).toEqual([])
    expect(readArchivedWorkspaces(h.dir)).toEqual([])
  })

  it('lets only a failed create go without a restore point', async () => {
    const { workspaceId: _never, ...unattached } = runtime('provisioning')
    h.runtimes = [unattached]
    await archiveCloudRuntimeBeforeDestroy(h.dir, 'orca-rt-1', 'failed-create', settle)
    expect(h.calls).toEqual([])
    expect(readArchivedWorkspaces(h.dir)).toEqual([])
  })

  it('does not believe "failed create" for a runtime that has a workspace', async () => {
    h.reads = [sandbox('running', []), sandbox('stopped', ['snap_stop00001'])]
    await archiveCloudRuntimeBeforeDestroy(h.dir, 'orca-rt-1', 'failed-create', settle)
    expect(h.calls).toEqual(['stop', 'delete-sandbox'])
    expect(restorePointIds()).toEqual(new Set(['snap_stop00001']))
    expect(readArchivedWorkspaces(h.dir)).toHaveLength(1)
  })

  it('leaves runtimes that are not cloud workspaces, or already cleaned, alone', async () => {
    h.runtimes = [{ ...runtime('running'), recipeId: 'other' }]
    await archiveCloudRuntimeBeforeDestroy(h.dir, 'orca-rt-1', undefined, settle)
    h.runtimes = [runtime('cleaned')]
    await archiveCloudRuntimeBeforeDestroy(h.dir, 'orca-rt-1', undefined, settle)
    expect(h.calls).toEqual([])
  })

  it('names no record without the facts Unarchive needs', () => {
    expect(runtimeArchiveRecord(runtime('running', { startCommit: 'nope' }), 's', 1)).toBeNull()
  })
})

describe('retireSandbox', () => {
  beforeEach(() => {
    h.dir = mkdtempSync(join(tmpdir(), 'revio-guard-'))
    h.calls = []
  })
  afterEach(() => {
    rmSync(h.dir, { recursive: true, force: true })
  })

  it('never deletes a snapshot kept as an archived workspace restore point', async () => {
    recordRestorePoint('snap_kept00001')
    const target = sandbox('stopped', ['snap_kept00001', 'snap_other0001'])
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake carries every Sandbox member retireSandbox reads (name, listSnapshots, delete).
    await retireSandbox(target as never, { token: 't', teamId: 'team', projectId: 'prj' })
    expect(h.calls).toEqual(['delete-snapshot:snap_other0001', 'delete-sandbox'])
  })
})
