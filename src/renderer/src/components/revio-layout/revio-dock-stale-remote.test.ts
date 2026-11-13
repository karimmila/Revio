// @vitest-environment happy-dom
import { beforeEach, expect, it } from 'vitest'

const OWNERS_KEY = 'orca.revioDockTerminals'
const LIVE_KEY = 'orca.revioDockLiveTabs'

const { FLOATING_TERMINAL_WORKTREE_ID } = await import('../../../../shared/constants')

function tab(id: string, title: string): Record<string, unknown> {
  return {
    id,
    ptyId: null,
    worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
    title,
    customTitle: title,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
}

beforeEach(() => {
  window.sessionStorage.clear()
  window.localStorage.clear()
})

it('closes a cloud workspace dock tab from an earlier app session and keeps the rest', async () => {
  // Owners persist across restarts; only `live-run` was started in this app session.
  window.localStorage.setItem(
    OWNERS_KEY,
    JSON.stringify({
      'old-run': 'c::/vercel/c',
      'live-run': 'c::/vercel/c',
      'mac-run': 'r::/repo/w'
    })
  )
  window.sessionStorage.setItem(LIVE_KEY, JSON.stringify(['live-run']))
  const { useAppStore } = await import('@/store')
  const { closeStaleRemoteDockTabs, dockTabOwner } = await import('./revio-dock-terminals')
  useAppStore.setState({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
    repos: [
      { id: 'c', path: '/vercel/c', displayName: 'c', executionHostId: 'runtime:env-1' },
      { id: 'r', path: '/repo', displayName: 'repo', connectionId: null }
    ] as never,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
    worktreesByRepo: {
      c: [{ id: 'c::/vercel/c', repoId: 'c', path: '/vercel/c' }],
      r: [{ id: 'r::/repo/w', repoId: 'r', path: '/repo/w' }]
    } as never,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
    tabsByWorktree: {
      [FLOATING_TERMINAL_WORKTREE_ID]: [
        tab('old-run', 'Run'),
        tab('live-run', 'Run'),
        tab('mac-run', 'Run')
      ]
    } as never
  })

  expect(closeStaleRemoteDockTabs()).toBe(1)
  const left = (useAppStore.getState().tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).map(
    (candidate) => candidate.id
  )
  expect(left).toEqual(['live-run', 'mac-run'])
  expect(dockTabOwner('old-run')).toBeNull()
  // A second pass has nothing left to close.
  expect(closeStaleRemoteDockTabs()).toBe(0)
})
