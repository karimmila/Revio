import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({ repos: [] }) } }))
vi.mock('./cloud-workspaces', () => ({ cloudSourceRepoIdNow: () => null }))

import { forgeRepoTarget } from './cloud-forge-repo'

const local = { id: 'local-1', path: '/Users/me/web', connectionId: null }
const cloud = {
  id: 'cloud-1',
  path: '/vercel/web',
  connectionId: null,
  executionHostId: 'runtime:env-1' as const
}
const repos = [local, cloud]
const sourceOf = (environmentId: string): string | null =>
  environmentId === 'env-1' ? 'local-1' : null

describe('forgeRepoTarget', () => {
  it('names the local repository a cloud workspace came from, not the sandbox path', () => {
    expect(forgeRepoTarget(cloud, sourceOf, repos)).toEqual({
      repoPath: '/Users/me/web',
      repoId: 'local-1'
    })
  })

  it('names a repository on this Mac as itself', () => {
    expect(forgeRepoTarget(local, sourceOf, repos)).toEqual({
      repoPath: '/Users/me/web',
      repoId: 'local-1'
    })
  })

  it('keeps the repository itself when the source is unknown or no longer listed', () => {
    const own = { repoPath: '/vercel/web', repoId: 'cloud-1' }
    expect(forgeRepoTarget(cloud, () => null, repos)).toEqual(own)
    expect(forgeRepoTarget(cloud, sourceOf, [cloud])).toEqual(own)
    expect(
      forgeRepoTarget({ ...cloud, executionHostId: 'runtime:other' }, sourceOf, repos)
    ).toEqual(own)
  })
})
