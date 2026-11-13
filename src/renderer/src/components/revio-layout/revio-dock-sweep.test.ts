import { describe, expect, it } from 'vitest'
import { removedWorktreeIds } from './revio-dock-sweep'

const listing = (ids: string[], repoIds: string[]) => ({
  ids: new Set(ids),
  repoIds: new Set(repoIds)
})

describe('removedWorktreeIds', () => {
  it('names a workspace archived from a repository that is still listed', () => {
    expect(
      removedWorktreeIds(listing(['r::/a', 'r::/b'], ['r']), listing(['r::/b'], ['r']))
    ).toEqual(new Set(['r::/a']))
  })

  it('removes nothing while a list loads or a repository is re-read', () => {
    expect(removedWorktreeIds(listing(['r::/a'], ['r']), listing([], []))).toEqual(new Set())
    expect(removedWorktreeIds(listing([], []), listing(['r::/a'], ['r']))).toEqual(new Set())
  })
})
