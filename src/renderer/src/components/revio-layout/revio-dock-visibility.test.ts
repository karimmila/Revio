import { describe, expect, it, vi } from 'vitest'

const owners = vi.hoisted(() => new Map<string, string>())
vi.mock('./revio-dock-terminals', () => ({
  isRemoteWorkspace: () => true,
  findDockTerminalForWorkspace: (tabIds: readonly string[], worktreeId: string | null) =>
    tabIds.find((tabId) => owners.get(tabId) === worktreeId) ?? null
}))

import { dockHasNothingForWorkspace } from './revio-dock-visibility'

describe('dockHasNothingForWorkspace', () => {
  const cloud = (id: string): boolean => id.startsWith('cloud::')

  it('is true only for a remote workspace with no Setup or Run tab in the dock', () => {
    owners.set('run-1', 'cloud::/vercel/app')
    expect(dockHasNothingForWorkspace('cloud::/vercel/other', ['run-1'], cloud)).toBe(true)
    expect(dockHasNothingForWorkspace('cloud::/vercel/app', ['run-1'], cloud)).toBe(false)
    // Before the session's tabs are restored the list is empty; that is not a reason to close.
    expect(dockHasNothingForWorkspace('cloud::/vercel/app', [], cloud)).toBe(true)
  })

  it('is never true on this Mac, where the dock opens a terminal, or with no workspace', () => {
    expect(dockHasNothingForWorkspace('repo::/ws/app', [], cloud)).toBe(false)
    expect(dockHasNothingForWorkspace(null, [], cloud)).toBe(false)
  })
})
