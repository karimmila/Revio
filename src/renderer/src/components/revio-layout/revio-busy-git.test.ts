import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: () => undefined }))

const { busyGitTitle } = await import('./RevioBusyGitNotice')

describe('busyGitTitle', () => {
  it('names the operation git is in the middle of', () => {
    expect(busyGitTitle('rebase')).toBe('Rebase in progress')
    expect(busyGitTitle('merge')).toBe('Merge in progress')
    expect(busyGitTitle('cherry-pick')).toBe('Cherry-pick in progress')
  })

  it('stays hidden while git is idle', () => {
    expect(busyGitTitle('unknown')).toBeNull()
    expect(busyGitTitle(undefined)).toBeNull()
  })
})
