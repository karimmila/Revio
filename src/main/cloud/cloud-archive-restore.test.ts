import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type MockState = {
  dir: string
  runtimes: unknown[]
  sandbox: null | Record<string, unknown>
  getError: unknown
  snapshotDeletes: string[]
  sandboxDeletes: number
  laterReads: Record<string, unknown>[]
}

const h = vi.hoisted((): MockState => ({
  dir: '',
  runtimes: [],
  sandbox: null,
  getError: null,
  snapshotDeletes: [],
  sandboxDeletes: 0,
  laterReads: []
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
      // A queued answer stands in for Vercel's later reads of a sandbox that is still stopping.
      return h.laterReads.shift() ?? h.sandbox
    }
  },
  Snapshot: {
    get: async ({ snapshotId }: { snapshotId: string }) => ({
      delete: async () => {
        h.snapshotDeletes.push(snapshotId)
      }
    })
  }
}))

import {
  hasPendingCloudRestore,
  pickRestoreSnapshot,
  prepareCloudRestore,
  recordRestorePoint,
  releaseRestorePoint,
  restoreCheckoutCommand,
  restorePointIds,
  retireCloudSandboxForArchive,
  takeCloudRestore
} from './cloud-archive-restore'
import { VERCEL_CLOUD_RECIPE_ID } from '../../shared/cloud/cloud-recipe'

function snapshot(
  id: string,
  createdAt: number,
  status: 'created' | 'deleted' | 'failed' = 'created'
) {
  return { id, createdAt, status }
}

function runtime(status: string) {
  return {
    id: 'rt-1',
    recipeId: VERCEL_CLOUD_RECIPE_ID,
    status,
    cleanupStatus: 'pending',
    createdAt: 1,
    updatedAt: 1,
    recipeResult: { userData: { sandboxName: 'revio-abc', repoName: 'repo' } }
  }
}

/** The SDK's paginator: `snapshots` is the first page only, `toArray` reads every page. */
function snapshotPages<T>(
  first: T[],
  ...later: T[][]
): { snapshots: T[]; toArray: () => Promise<T[]> } {
  return { snapshots: first, toArray: async () => [...first, ...later.flat()] }
}

function asleepSandbox(overrides: Record<string, unknown> = {}) {
  return {
    name: 'revio-abc',
    status: 'stopped',
    tags: { orca: 'workspace' },
    currentSnapshotId: 'snap_current01',
    listSnapshots: async () =>
      snapshotPages([snapshot('snap_older0001', 1)], [snapshot('snap_current01', 2)]),
    delete: async () => {
      h.sandboxDeletes += 1
    },
    ...overrides
  }
}

describe('cloud archive restore points', () => {
  beforeEach(() => {
    h.dir = mkdtempSync(join(tmpdir(), 'revio-restore-'))
    h.runtimes = [runtime('suspended')]
    h.sandbox = asleepSandbox()
    h.getError = null
    h.snapshotDeletes = []
    h.sandboxDeletes = 0
    h.laterReads = []
  })
  afterEach(() => {
    rmSync(h.dir, { recursive: true, force: true })
  })

  it('keeps the sandbox resume snapshot, else its newest created one', () => {
    const list = [snapshot('a', 1), snapshot('b', 3), snapshot('c', 2), snapshot('d', 9, 'failed')]
    expect(pickRestoreSnapshot('c', list)).toBe('c')
    expect(pickRestoreSnapshot('d', list)).toBe('b')
    expect(pickRestoreSnapshot(undefined, list)).toBe('b')
    expect(pickRestoreSnapshot(undefined, [])).toBeNull()
  })

  it('deletes an asleep sandbox and its other snapshots without resuming it', async () => {
    expect(await retireCloudSandboxForArchive('/u', 'rt-1')).toEqual({
      restoreSnapshotId: 'snap_current01'
    })
    expect(h.snapshotDeletes).toEqual(['snap_older0001'])
    expect(h.sandboxDeletes).toBe(1)
    expect(restorePointIds().has('snap_current01')).toBe(true)
  })

  it('refuses a sandbox that never finishes stopping, deleting nothing', async () => {
    h.sandbox = asleepSandbox({ status: 'snapshotting' })
    await expect(
      retireCloudSandboxForArchive('/u', 'rt-1', { timeoutMs: 0, sleep: async () => {} })
    ).rejects.toThrow(/still going to sleep/)
    expect(h.sandboxDeletes).toBe(0)
    expect(h.snapshotDeletes).toEqual([])
  })

  it('stops an awake sandbox first so its stop snapshot becomes the restore point', async () => {
    const stops: string[] = []
    h.runtimes = [runtime('running')]
    const running = asleepSandbox({
      status: 'running',
      stop: async () => {
        stops.push('stop')
      }
    })
    h.laterReads = [running, asleepSandbox({ status: 'stopping' }), asleepSandbox()]
    const settle = { pollMs: 1, sleep: async () => {} }
    expect(await retireCloudSandboxForArchive('/u', 'rt-1', settle)).toEqual({
      restoreSnapshotId: 'snap_current01'
    })
    expect(stops).toEqual(['stop'])
    expect(h.sandboxDeletes).toBe(1)
    expect(restorePointIds().has('snap_current01')).toBe(true)
  })

  it('keeps an awake sandbox whose stop left no snapshot', async () => {
    h.laterReads = [
      asleepSandbox({ status: 'running', stop: async () => {} }),
      asleepSandbox({
        currentSnapshotId: undefined,
        listSnapshots: async () => snapshotPages([])
      })
    ]
    await expect(retireCloudSandboxForArchive('/u', 'rt-1')).rejects.toThrow(/no snapshot/)
    expect(h.sandboxDeletes).toBe(0)
  })

  it('keeps a sandbox that is still running after its stop', async () => {
    h.laterReads = [
      asleepSandbox({ status: 'running', stop: async () => {} }),
      asleepSandbox({ status: 'running' })
    ]
    await expect(retireCloudSandboxForArchive('/u', 'rt-1')).rejects.toThrow(/kept/)
    expect(h.sandboxDeletes).toBe(0)
  })

  it('deletes nothing when Vercel cannot be reached', async () => {
    h.getError = new Error('fetch failed: ECONNRESET')
    await expect(retireCloudSandboxForArchive('/u', 'rt-1')).rejects.toThrow(/ECONNRESET/)
    expect(h.sandboxDeletes).toBe(0)
    expect(h.snapshotDeletes).toEqual([])
  })

  it('waits for a stopping sandbox to finish its snapshot before deleting it', async () => {
    h.laterReads = [
      asleepSandbox({ status: 'stopping' }),
      asleepSandbox({ status: 'snapshotting' }),
      asleepSandbox()
    ]
    const naps: number[] = []
    const settle = { pollMs: 5, sleep: async (ms: number) => void naps.push(ms) }
    expect(await retireCloudSandboxForArchive('/u', 'rt-1', settle)).toEqual({
      restoreSnapshotId: 'snap_current01'
    })
    expect(naps).toEqual([5, 5])
    expect(h.sandboxDeletes).toBe(1)
  })

  it('treats a sandbox already gone from Vercel as archived with no restore point', async () => {
    h.getError = Object.assign(new Error('Sandbox not found'), { response: { status: 404 } })
    expect(await retireCloudSandboxForArchive('/u', 'rt-1')).toEqual({ restoreSnapshotId: null })
  })

  it('arms one restore per repository and branch, only from a kept restore point', () => {
    const args = {
      repoId: 'r1',
      branch: 'me/feat',
      snapshotId: 'snap_kept00001',
      commit: 'abc1234'
    }
    expect(() => prepareCloudRestore(args)).toThrow(/restore point/)
    recordRestorePoint('snap_kept00001')
    prepareCloudRestore(args)
    expect(hasPendingCloudRestore('r1', 'me/feat')).toBe(true)
    expect(takeCloudRestore('r1', 'me/other')).toBeNull()
    expect(takeCloudRestore('r1', 'me/feat')).toEqual({
      snapshotId: 'snap_kept00001',
      commit: 'abc1234'
    })
    expect(takeCloudRestore('r1', 'me/feat')).toBeNull()
  })

  it('arms a build-and-commit restore when Vercel kept no snapshot', () => {
    prepareCloudRestore({ repoId: 'r1', branch: 'me/feat', snapshotId: null, commit: 'abc1234' })
    expect(takeCloudRestore('r1', 'me/feat')).toEqual({ snapshotId: null, commit: 'abc1234' })
  })

  it('deletes a released restore point once, and only one this Mac kept', async () => {
    recordRestorePoint('snap_kept00001')
    await releaseRestorePoint('snap_kept00001')
    await releaseRestorePoint('snap_kept00001')
    await releaseRestorePoint('snap_unknown01')
    expect(h.snapshotDeletes).toEqual(['snap_kept00001'])
    expect([...restorePointIds()]).toEqual([])
  })

  it('leaves a snapshot checkout alone and rebuilds one from the commit, branch or base', () => {
    const restore = { snapshotId: null, commit: 'abc1234' }
    expect(restoreCheckoutCommand(restore, true, 'me/feat', 'FRESH')).toBe(':')
    expect(restoreCheckoutCommand(restore, false, undefined, 'FRESH')).toBe('FRESH')
    const script = restoreCheckoutCommand(restore, false, 'me/feat', 'FRESH')
    expect(script).toContain("git fetch --quiet origin 'abc1234'")
    expect(script).toContain("git checkout -q -f -B 'me/feat' 'abc1234'")
    expect(script).toContain("'refs/heads/me/feat'")
    expect(script).toMatch(/else FRESH; fi$/)
  })
})
