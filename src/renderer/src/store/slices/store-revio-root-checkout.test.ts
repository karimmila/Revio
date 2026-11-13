import { describe, expect, it, vi } from 'vitest'
import type * as AgentStatusModule from '@/lib/agent-status'
import { getDefaultSettings } from '../../../../shared/constants'
import { createTestStore, makeWorktree, seedStore, TEST_REPO } from './store-test-helpers'
import { createStoreSessionMockApi } from './store-session-test-harness'

const storeAccess = vi.hoisted(() => ({ getState: vi.fn() }))
vi.mock('@/store', () => ({ useAppStore: storeAccess }))
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/agent-status', async (importOriginal) => {
  const actual = await importOriginal<typeof AgentStatusModule>()
  return { ...actual, detectAgentStatusFromTitle: vi.fn().mockReturnValue(null) }
})
vi.mock('@/lib/workspace/activation/worktree-activation', () => ({
  activateAndRevealWorktree: vi.fn()
}))

import { pickActiveWorktreeSuccessor } from '@/lib/active-worktree-removal-successor'
import { installRevioRootCheckoutGuard } from '@/lib/revio-root-checkout-guard'

createStoreSessionMockApi()

const root = makeWorktree({ id: 'repo1::/code/app', repoId: 'repo1', isMainWorktree: true })
const workspace = makeWorktree({ id: 'repo1::/ws/app/oslo', repoId: 'repo1' })

function setup(revioLayout: boolean, worktrees = [root, workspace]) {
  const store = createTestStore()
  seedStore(store, {
    repos: [{ ...TEST_REPO, executionHostId: 'local' }],
    worktreesByRepo: { repo1: worktrees },
    settings: { ...getDefaultSettings('/home/test'), revioLayout },
    activeView: 'terminal'
  })
  storeAccess.getState.mockImplementation(store.getState)
  return store
}

describe('the repository’s own checkout in the workspace layout', () => {
  it('never becomes the open workspace: the request lands on Home', () => {
    const store = setup(true)
    store.getState().setActiveWorktree(workspace.id)
    expect(store.getState().setActiveWorktree(root.id)).toBe(false)
    expect(store.getState().activeWorktreeId).toBeNull()
    expect(store.getState().tabsByWorktree[root.id] ?? []).toEqual([])
  })

  it('still opens in the classic layout', () => {
    const store = setup(false)
    expect(store.getState().setActiveWorktree(root.id)).toBe(true)
    expect(store.getState().activeWorktreeId).toBe(root.id)
  })

  it('is not the successor after a workspace is archived: the layout goes to Home', () => {
    const removed = { id: workspace.id, hostId: null, repoId: 'repo1', ownerHostIds: [] }
    expect(pickActiveWorktreeSuccessor(setup(true, [root]).getState(), removed)).toBeNull()
    expect(pickActiveWorktreeSuccessor(setup(false, [root]).getState(), removed)?.id).toBe(root.id)
    // Nor is a neighbour opened, which would start a terminal nobody asked for.
    const other = makeWorktree({ id: 'repo1::/ws/app/lima', repoId: 'repo1' })
    expect(pickActiveWorktreeSuccessor(setup(true, [root, other]).getState(), removed)).toBeNull()
    expect(pickActiveWorktreeSuccessor(setup(false, [root, other]).getState(), removed)?.id).toBe(
      other.id
    )
  })

  it('is not reopened on relaunch, as the saved view or as the fallback', () => {
    const saved = setup(true)
    saved.getState().hydrateWorkspaceSession({
      activeRepoId: 'repo1',
      activeWorktreeId: root.id,
      activeTabId: null,
      tabsByWorktree: {},
      terminalLayoutsByTabId: {}
    })
    expect(saved.getState().activeWorktreeId).toBeNull()

    const onHome = setup(true)
    onHome.getState().hydrateWorkspaceSession({
      activeRepoId: 'repo1',
      activeWorktreeId: null,
      activeTabId: null,
      tabsByWorktree: {},
      terminalLayoutsByTabId: {}
    })
    expect(onHome.getState().activeWorktreeId).toBeNull()

    const classic = setup(false)
    classic.getState().hydrateWorkspaceSession({
      activeRepoId: 'repo1',
      activeWorktreeId: null,
      activeTabId: null,
      tabsByWorktree: {},
      terminalLayoutsByTabId: {}
    })
    expect(classic.getState().activeWorktreeId).toBe(root.id)
  })

  it('reopens the workspace that was open', () => {
    const store = setup(true)
    store.getState().hydrateWorkspaceSession({
      activeRepoId: 'repo1',
      activeWorktreeId: workspace.id,
      activeTabId: null,
      tabsByWorktree: {},
      terminalLayoutsByTabId: {}
    })
    expect(store.getState().activeWorktreeId).toBe(workspace.id)
  })

  it('is left for Home when a selection was set before the facts were in', () => {
    const store = setup(true)
    store.setState({ activeWorktreeId: root.id })
    const dispose = installRevioRootCheckoutGuard(store)
    expect(store.getState().activeWorktreeId).toBeNull()

    // A profile that switches to the workspace layout with a root checkout open.
    const switching = setup(false)
    switching.getState().setActiveWorktree(root.id)
    const disposeSwitching = installRevioRootCheckoutGuard(switching)
    expect(switching.getState().activeWorktreeId).toBe(root.id)
    switching.setState({ settings: { ...getDefaultSettings('/home/test'), revioLayout: true } })
    expect(switching.getState().activeWorktreeId).toBeNull()
    dispose()
    disposeSwitching()
  })
})
