import { beforeEach, describe, expect, it, vi } from 'vitest'

const pool = vi.hoisted(() => {
  const entries: { repoPathKey: string }[] = []
  return {
    entries,
    discardRepo: vi.fn(),
    settle: vi.fn(async () => undefined),
    staleCleanup: vi.fn(async () => undefined)
  }
})
vi.mock('./worktree-create-preparation-pool', () => ({
  listPreparations: () => pool.entries,
  discardRepoPreparations: pool.discardRepo
}))
vi.mock('./worktree-preparation-discard-retry', () => ({
  settlePreparationDiscards: pool.settle,
  preparationHostKey: (repoPathKey: string, distro: string) => `${repoPathKey}|${distro}`
}))
vi.mock('./worktree-create-preparation-stale-cleanup', () => ({
  startStalePreparationCleanup: pool.staleCleanup
}))
vi.mock('./worktree-create-preparation-claim', () => ({
  preparationPathKey: (path: string) => `key:${path}`
}))
vi.mock('../../../git/worktrees/creation/worktree-create-git-executor', () => ({
  worktreePreparationGit: { run: (work: () => Promise<void>) => work() }
}))
vi.mock('../../execution-host/project-runtime-git-options', () => ({
  getLocalProjectWorktreeGitOptions: () => ({})
}))
vi.mock('../../../wsl/filesystem/wsl-unc-access-gate', () => ({
  blockedWslDistroForPath: async () => false
}))

import { discardWorktreeCreatePreparationsOnQuit } from './worktree-create-preparation-quit'
import { reclaimStaleWorktreeCreatePreparations } from './worktree-create-preparation-project-removal'

beforeEach(() => {
  pool.entries = []
  pool.discardRepo.mockClear()
  pool.settle.mockClear()
  pool.staleCleanup.mockClear()
})

describe('prepared checkouts', () => {
  it('are all discarded at quit, once per project, and the discards are awaited', async () => {
    pool.entries = [{ repoPathKey: 'a' }, { repoPathKey: 'a' }, { repoPathKey: 'b' }]
    await discardWorktreeCreatePreparationsOnQuit()
    expect(pool.discardRepo.mock.calls).toEqual([['a'], ['b']])
    expect(pool.settle).toHaveBeenCalledOnce()
  })

  it('left by a killed quit are reclaimed at launch for local Git projects only', async () => {
    const repo = (id: string, extra: Record<string, unknown> = {}) => ({
      id,
      path: `/code/${id}`,
      displayName: id,
      badgeColor: '#000',
      addedAt: 0,
      ...extra
    })
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the Git options reader is mocked and never reads the store
    reclaimStaleWorktreeCreatePreparations({ getSettings: () => ({}) } as never, [
      repo('app'),
      repo('notes', { kind: 'folder' }),
      repo('remote', { connectionId: 'ssh-host' })
    ])
    await vi.waitFor(() => expect(pool.staleCleanup).toHaveBeenCalledOnce())
    expect(pool.staleCleanup).toHaveBeenCalledWith('key:/code/app|', '/code/app', {})
  })
})
