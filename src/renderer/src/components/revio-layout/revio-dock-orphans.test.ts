// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const OWNERS_KEY = 'orca.revioDockTerminals'
const LIVE_KEY = 'orca.revioDockLiveTabs'

const { FLOATING_TERMINAL_WORKTREE_ID } = await import('../../../../shared/constants')

function tab(id: string): Record<string, unknown> {
  return {
    id,
    ptyId: null,
    worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
    title: 'Terminal 1',
    customTitle: 'Terminal 1',
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
}

beforeEach(() => {
  // The dock reads its owners from storage when its module loads.
  vi.resetModules()
  window.sessionStorage.clear()
  window.localStorage.clear()
})

describe('orphanDockWorkspaceIds', () => {
  const facts = {
    owners: {
      kept: 'r::/repo/kept',
      archived: 'r::/repo/archived',
      loading: 'slow::/slow/w',
      'deleted-cloud': 'c::/vercel/c',
      'removed-project': 'gone::/gone/w'
    },
    liveTabIds: new Set<string>(),
    listedWorktreeIds: new Set(['r::/repo/kept']),
    listedRepoIds: new Set(['r']),
    knownRepoIds: new Set(['r', 'slow'])
  }

  it('names workspaces archived from a listed repository, and those whose repository is gone', async () => {
    const { orphanDockWorkspaceIds } = await import('./revio-dock-orphans')
    expect(orphanDockWorkspaceIds(facts)).toEqual(
      new Set(['r::/repo/archived', 'c::/vercel/c', 'gone::/gone/w'])
    )
  })

  it('leaves a repository that is still loading, and a workspace with a tab from this session', async () => {
    const { orphanDockWorkspaceIds } = await import('./revio-dock-orphans')
    const orphans = orphanDockWorkspaceIds({
      ...facts,
      owners: { ...facts.owners, 'cloud-setup': 'c::/vercel/c', 'cloud-run': 'c::/vercel/c' },
      liveTabIds: new Set(['cloud-run'])
    })
    expect(orphans.has('slow::/slow/w')).toBe(false)
    // The cloud workspace's sandbox is reconnecting: its repository is not listed yet.
    expect(orphans.has('c::/vercel/c')).toBe(false)
  })
})

describe('closeOrphanDockTabs', () => {
  async function seed(overrides: { repos?: unknown[]; ready?: boolean } = {}) {
    window.localStorage.setItem(
      OWNERS_KEY,
      JSON.stringify({
        mine: 'r::/repo/w',
        'deleted-cloud': 'c::/vercel/c',
        live: 'c2::/vercel/c2'
      })
    )
    window.sessionStorage.setItem(LIVE_KEY, JSON.stringify(['live']))
    const { useAppStore } = await import('@/store')
    useAppStore.setState({
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
      settings: { revioLayout: true } as never,
      workspaceSessionReady: overrides.ready ?? true,
      awaitLocalRepoCatalogSettlement: async () => undefined,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
      repos: (overrides.repos ?? [
        { id: 'r', path: '/repo', displayName: 'repo', connectionId: null }
      ]) as never,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
      worktreesByRepo: { r: [{ id: 'r::/repo/w', repoId: 'r', path: '/repo/w' }] } as never,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
      tabsByWorktree: {
        [FLOATING_TERMINAL_WORKTREE_ID]: [tab('mine'), tab('deleted-cloud'), tab('live')]
      } as never
    })
    const dockTabs = (): string[] =>
      (useAppStore.getState().tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).map(
        (candidate) => candidate.id
      )
    return { dockTabs }
  }

  it('closes the tabs of a deleted cloud workspace and keeps the rest', async () => {
    const { dockTabs } = await seed()
    const { closeOrphanDockTabs } = await import('./revio-dock-orphans')
    const { dockTabOwner } = await import('./revio-dock-terminals')
    expect(await closeOrphanDockTabs()).toBe(1)
    expect(dockTabs()).toEqual(['mine', 'live'])
    expect(dockTabOwner('deleted-cloud')).toBeNull()
    expect(await closeOrphanDockTabs()).toBe(0)
  })

  it('closes nothing before the saved session is ready', async () => {
    const { dockTabs } = await seed({ ready: false })
    const { closeOrphanDockTabs } = await import('./revio-dock-orphans')
    expect(await closeOrphanDockTabs()).toBe(0)
    expect(dockTabs()).toEqual(['mine', 'deleted-cloud', 'live'])
  })

  it('closes nothing when no repository on this Mac is listed: the list may not have loaded', async () => {
    const { dockTabs } = await seed({ repos: [] })
    const { closeOrphanDockTabs } = await import('./revio-dock-orphans')
    expect(await closeOrphanDockTabs()).toBe(0)
    expect(dockTabs()).toEqual(['mine', 'deleted-cloud', 'live'])
  })
})

describe('dockMountTabIds', () => {
  const owners = { a1: 'r::/a', a2: 'r::/a', b1: 'r::/b', gone: 'x::/gone' }
  const tabIds = ['a1', 'a2', 'b1', 'gone', 'unowned']

  it('mounts only the active workspace’s terminals at launch', async () => {
    const { dockMountTabIds } = await import('./revio-dock-orphans')
    expect(dockMountTabIds(new Set(), tabIds, 'r::/a', owners)).toEqual(new Set(['a1', 'a2']))
    expect(dockMountTabIds(new Set(), tabIds, null, owners)).toEqual(new Set())
  })

  it('adds a workspace’s terminals when it is first opened and keeps those shown before', async () => {
    const { dockMountTabIds } = await import('./revio-dock-orphans')
    const first = dockMountTabIds(new Set(), tabIds, 'r::/a', owners)
    const second = dockMountTabIds(first, tabIds, 'r::/b', owners)
    expect(second).toEqual(new Set(['a1', 'a2', 'b1']))
    // Closed tabs leave; an unchanged set keeps its identity so nothing re-renders.
    expect(dockMountTabIds(second, ['a1', 'b1', 'gone'], 'r::/b', owners)).toEqual(
      new Set(['a1', 'b1'])
    )
    expect(dockMountTabIds(second, tabIds, 'r::/b', owners)).toBe(second)
  })
})
