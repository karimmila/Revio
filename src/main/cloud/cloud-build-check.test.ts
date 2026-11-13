import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CloudBuild } from '../../shared/cloud/cloud-types'

vi.mock('@vercel/sandbox', () => ({ Snapshot: { get: vi.fn() } }))
vi.mock('../vercel-cloud/vercel-cloud-auth', () => ({ vercelScope: vi.fn() }))
vi.mock('./cloud-build', () => ({ isCloudBuildRunning: () => false }))

const { CLOUD_BUILD_EXPIRED, checkCloudBuild } = await import('./cloud-build-check')
const { readRepoFile, saveCloudBuild, setCloudDataRoot } = await import('./cloud-repo-store')
const { missingBuildReason } = await import('./cloud-readiness')

const build: CloudBuild = {
  id: 'b1',
  state: 'succeeded',
  step: 'Ready',
  startedAt: 1,
  finishedAt: 2,
  commit: 'abc',
  snapshotId: 'snap_12345678',
  error: null
}

let root = ''
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-cloud-check-'))
  setCloudDataRoot(() => root)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('checkCloudBuild', () => {
  it('answers ready for a snapshot Vercel still has, in one lookup', async () => {
    saveCloudBuild('r1', build)
    const lookUp = vi.fn(async () => ({ status: 'created' }))
    expect(await checkCloudBuild('r1', lookUp)).toBe('ready')
    expect(lookUp).toHaveBeenCalledTimes(1)
    expect(lookUp).toHaveBeenCalledWith('snap_12345678')
    expect(readRepoFile('r1').builds[0]?.snapshotId).toBe('snap_12345678')
  })

  it('clears a snapshot Vercel answers 404 for, so readiness asks for a rebuild', async () => {
    saveCloudBuild('r1', build)
    const lookUp = vi.fn(async () => {
      throw Object.assign(new Error('Snapshot not found'), { status: 404 })
    })
    expect(await checkCloudBuild('r1', lookUp)).toBe('expired')
    const saved = readRepoFile('r1').builds
    expect(saved[0]).toMatchObject({ snapshotId: null, error: CLOUD_BUILD_EXPIRED })
    expect(missingBuildReason(saved, 'me/repo')).toBe(
      'Vercel no longer has the cloud build of me/repo. Rebuild it to create cloud workspaces.'
    )
  })

  it('treats a deleted or past-expiry snapshot as gone', async () => {
    saveCloudBuild('r1', build)
    expect(await checkCloudBuild('r1', async () => ({ status: 'deleted' }))).toBe('expired')
    saveCloudBuild('r2', build)
    expect(
      await checkCloudBuild('r2', async () => ({ status: 'created', expiresAt: new Date(5) }), 10)
    ).toBe('expired')
  })

  it('leaves the build alone when Vercel cannot be asked', async () => {
    saveCloudBuild('r1', build)
    const lookUp = vi.fn(async () => {
      throw Object.assign(new Error('fetch failed'), { status: 503 })
    })
    expect(await checkCloudBuild('r1', lookUp)).toBe('ready')
    expect(readRepoFile('r1').builds[0]?.snapshotId).toBe('snap_12345678')
  })

  it('answers missing without asking Vercel when no build exists', async () => {
    const lookUp = vi.fn()
    expect(await checkCloudBuild('r1', lookUp)).toBe('missing')
    expect(lookUp).not.toHaveBeenCalled()
  })
})
