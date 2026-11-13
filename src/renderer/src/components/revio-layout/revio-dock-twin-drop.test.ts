// @vitest-environment happy-dom
import { beforeEach, expect, it } from 'vitest'

const OWNERS_KEY = 'orca.revioDockTerminals'
const { FLOATING_TERMINAL_WORKTREE_ID } = await import('../../../../shared/constants')

function tab(id: string, ptyId: string): Record<string, unknown> {
  return {
    id,
    ptyId,
    worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
    title: '.',
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

it('drops the unowned twin main publishes for a background dock start, keeping the owned tab', async () => {
  window.localStorage.setItem(OWNERS_KEY, JSON.stringify({ run: 'r::/repo/w' }))
  const { useAppStore } = await import('@/store')
  const { dropUnownedTwinsOf } = await import('./revio-dock-background-start')
  useAppStore.setState({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
    tabsByWorktree: {
      [FLOATING_TERMINAL_WORKTREE_ID]: [
        tab('run', 'pty-1'),
        tab('twin', 'pty-1'),
        tab('other', 'pty-2')
      ]
    } as never
  })
  dropUnownedTwinsOf('run', 'pty-1')
  const left = (useAppStore.getState().tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).map(
    (candidate) => [candidate.id, candidate.ptyId]
  )
  expect(left).toEqual([
    ['run', 'pty-1'],
    ['other', 'pty-2']
  ])
})
