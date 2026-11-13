import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const root = vi.hoisted(() => ({ dir: '' }))
const vercel = vi.hoisted(() => {
  const deleted: string[] = []
  const sandboxes: Record<string, { tags?: Record<string, string> }> = {}
  return { deleted, sandboxes }
})
const runtimes = vi.hoisted(() => {
  const list: Record<string, unknown>[] = []
  return { list }
})

vi.mock('./cloud-repo-store', () => ({ cloudDataRoot: () => root.dir }))
vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    get: vi.fn(async ({ name }: { name: string }) => {
      const found = vercel.sandboxes[name]
      if (!found) {
        throw Object.assign(new Error('not found'), { status: 404 })
      }
      return { name, tags: found.tags }
    })
  }
}))
vi.mock('./cloud-sandbox-retire', () => ({
  retireSandbox: vi.fn(async (sandbox: { name: string }) => {
    vercel.deleted.push(sandbox.name)
  })
}))
vi.mock('../vercel-cloud/vercel-cloud-auth', () => ({
  vercelScope: vi.fn(async () => ({ token: 't', teamId: 'team', projectId: 'p' }))
}))
vi.mock('../../shared/ephemeral-vm-runtime-store', () => ({
  listEphemeralVmRuntimes: () => runtimes.list
}))

import {
  markSandboxPending,
  pendingSandboxNames,
  sweepPendingSandboxes
} from './cloud-pending-sandboxes'

describe('pending sandboxes', () => {
  beforeEach(() => {
    root.dir = mkdtempSync(join(tmpdir(), 'orca-pending-'))
    vercel.deleted.length = 0
    runtimes.list = []
    for (const key of Object.keys(vercel.sandboxes)) {
      delete vercel.sandboxes[key]
    }
  })
  afterEach(() => {
    rmSync(root.dir, { recursive: true, force: true })
  })

  it('adopts a sandbox a workspace owns and deletes the leftovers', async () => {
    markSandboxPending('orca-adopted')
    markSandboxPending('orca-leftover')
    markSandboxPending('orca-gone')
    runtimes.list = [
      {
        recipeId: 'orca-cloud-vercel',
        status: 'running',
        recipeResult: { userData: { sandboxName: 'orca-adopted' } }
      }
    ]
    vercel.sandboxes['orca-leftover'] = { tags: { orca: 'workspace' } }
    await sweepPendingSandboxes('/data')
    expect(vercel.deleted).toEqual(['orca-leftover'])
    expect(pendingSandboxNames()).toEqual([])
  })

  it('keeps the record when Vercel cannot be asked, to retry at the next start', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    markSandboxPending('orca-later')
    vercel.sandboxes['orca-later'] = { tags: { orca: 'workspace' } }
    const { retireSandbox } = await import('./cloud-sandbox-retire')
    vi.mocked(retireSandbox).mockRejectedValueOnce(new Error('Vercel unreachable'))
    await sweepPendingSandboxes('/data')
    expect(pendingSandboxNames()).toEqual(['orca-later'])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
