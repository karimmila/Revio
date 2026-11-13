import { expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))
vi.mock('@/components/sidebar/workspace-actions/deletion/delete-worktree-flow', () => ({
  runWorktreeDelete: vi.fn()
}))
vi.mock('@/lib/revio-archive', () => ({ revioArchivesWithoutAsking: () => true }))

const { shouldArchiveOnMerge } = await import('./use-archive-on-merge')
const base = {
  enabled: true,
  wasOpen: true,
  merged: true,
  cloud: false,
  stackHasOpenPrs: false,
  agentsQuiet: true
}

it('archives when a watched open PR turns merged', () => {
  expect(shouldArchiveOnMerge(base)).toBe(true)
})

it('refuses for cloud, open stacks, running agents, unseen merges or the setting off', () => {
  expect(shouldArchiveOnMerge({ ...base, cloud: true })).toBe(false)
  expect(shouldArchiveOnMerge({ ...base, stackHasOpenPrs: true })).toBe(false)
  expect(shouldArchiveOnMerge({ ...base, agentsQuiet: false })).toBe(false)
  expect(shouldArchiveOnMerge({ ...base, wasOpen: false })).toBe(false)
  expect(shouldArchiveOnMerge({ ...base, enabled: false })).toBe(false)
})
