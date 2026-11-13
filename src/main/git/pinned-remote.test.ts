import { expect, it, vi } from 'vitest'

const git = vi.hoisted(() => ({ exec: vi.fn() }))
vi.mock('./runner', () => ({ gitExecFileAsync: git.exec }))
vi.mock('./git-runtime-options', () => ({
  gitOptionsForWorktree: (cwd: string) => ({ cwd })
}))

import {
  listGitRemotes,
  pinnedRemotePushTarget,
  repoIdOfWorktreeId,
  setPinnedRemoteLookup
} from './pinned-remote'

it('targets the pinned remote with the checked-out branch', async () => {
  setPinnedRemoteLookup(({ repoId }) => (repoId === 'r1' ? 'fork' : null))
  git.exec.mockResolvedValueOnce({ stdout: 'feature/x\n' })
  await expect(pinnedRemotePushTarget('/w', { repoId: 'r1' })).resolves.toEqual({
    remoteName: 'fork',
    branchName: 'feature/x'
  })
  expect(git.exec).toHaveBeenCalledWith(['symbolic-ref', '--quiet', '--short', 'HEAD'], {
    cwd: '/w'
  })
})

it('keeps Automatic and detached HEAD on Orca’s own choice', async () => {
  setPinnedRemoteLookup(() => null)
  await expect(pinnedRemotePushTarget('/w', { repoId: 'r1' })).resolves.toBeUndefined()
  setPinnedRemoteLookup(() => 'fork')
  git.exec.mockRejectedValueOnce(new Error('detached'))
  await expect(pinnedRemotePushTarget('/w', { repoId: 'r1' })).resolves.toBeUndefined()
})

it('reads the repo id from a worktree id', () => {
  expect(repoIdOfWorktreeId('repo-1::/a/b')).toBe('repo-1')
  expect(repoIdOfWorktreeId(undefined)).toBeUndefined()
})

it('lists the repository remotes', async () => {
  git.exec.mockResolvedValueOnce({ stdout: 'origin\nupstream\n\n' })
  await expect(listGitRemotes('/repo')).resolves.toEqual(['origin', 'upstream'])
})
