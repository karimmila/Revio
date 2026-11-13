import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const root = vi.hoisted(() => ({ dir: '' }))
const vercel = vi.hoisted(() => {
  const sandboxes: { name: string; status: string; currentSnapshotId?: string }[] = []
  const snapshots: { id: string; status: string }[] = []
  const deleted: string[] = []
  return { sandboxes, snapshots, deleted }
})
const restorePoints = vi.hoisted(() => ({ ids: new Set<string>() }))

async function* pages<T>(items: T[]): AsyncGenerator<T> {
  yield* items
}

vi.mock('./cloud-repo-store', () => ({
  cloudDataRoot: () => root.dir,
  readRepoFile: () => ({ builds: [] })
}))
vi.mock('./cloud-build', () => ({ isCloudBuildRunning: () => false }))
vi.mock('./cloud-sandbox-retire', () => ({ retireSandbox: vi.fn() }))
vi.mock('./cloud-archive-restore', () => ({
  restorePointIds: () => new Set(restorePoints.ids)
}))
vi.mock('../vercel-cloud/vercel-cloud-auth', () => ({
  vercelScope: vi.fn(async () => ({ token: 't', teamId: 'team', projectId: 'p' }))
}))
vi.mock('../../shared/ephemeral-vm-runtime-store', () => ({
  listEphemeralVmRuntimes: () => []
}))
vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    list: vi.fn(async () =>
      pages(vercel.sandboxes.map((entry) => ({ ...entry, tags: {}, createdAt: 1 })))
    )
  },
  Snapshot: {
    list: vi.fn(async () =>
      pages(
        vercel.snapshots.map((entry) => ({
          ...entry,
          sizeBytes: 1,
          createdAt: 1,
          creationMethod: 'automatic'
        }))
      )
    ),
    get: vi.fn(async ({ snapshotId }: { snapshotId: string }) => ({
      delete: async () => {
        vercel.deleted.push(snapshotId)
      }
    }))
  }
}))

import { deleteUnusedSnapshot, readCloudInventory } from './cloud-inventory'

describe('cloud inventory snapshots', () => {
  beforeEach(() => {
    root.dir = mkdtempSync(join(tmpdir(), 'orca-inventory-'))
    vercel.sandboxes.length = 0
    vercel.snapshots.length = 0
    vercel.deleted.length = 0
    restorePoints.ids.clear()
  })
  afterEach(() => {
    rmSync(root.dir, { recursive: true, force: true })
  })

  it('lists the snapshot a sleeping sandbox wakes from as in use', async () => {
    vercel.sandboxes.push({
      name: 'ws-asleep',
      status: 'stopped',
      currentSnapshotId: 'snap_asleep01'
    })
    vercel.snapshots.push(
      { id: 'snap_asleep01', status: 'created' },
      { id: 'snap_leftover1', status: 'created' }
    )
    const inventory = await readCloudInventory(root.dir)
    expect(inventory.snapshots.map(({ id, referenced }) => [id, referenced])).toEqual([
      ['snap_asleep01', true],
      ['snap_leftover1', false]
    ])
  })

  it('refuses to delete the snapshot a sleeping sandbox wakes from', async () => {
    vercel.sandboxes.push({
      name: 'ws-asleep',
      status: 'stopped',
      currentSnapshotId: 'snap_asleep01'
    })
    await expect(deleteUnusedSnapshot('snap_asleep01')).rejects.toThrow(/sleeping workspace/)
    expect(vercel.deleted).toEqual([])
  })

  it('refuses to delete an archived workspace restore point', async () => {
    restorePoints.ids.add('snap_restore01')
    await expect(deleteUnusedSnapshot('snap_restore01')).rejects.toThrow(/still uses/)
    expect(vercel.deleted).toEqual([])
  })

  it('deletes a snapshot nothing uses', async () => {
    vercel.sandboxes.push({
      name: 'ws-asleep',
      status: 'stopped',
      currentSnapshotId: 'snap_asleep01'
    })
    await deleteUnusedSnapshot('snap_leftover1')
    expect(vercel.deleted).toEqual(['snap_leftover1'])
  })
})
