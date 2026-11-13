// @vitest-environment happy-dom
import { beforeEach, expect, it } from 'vitest'

const { useAppStore } = await import('@/store')
const { osc52PaneOrigin } = await import('./osc52-pane-source')

const tab = (id: string, worktreeId: string): Record<string, unknown> => ({
  id,
  ptyId: null,
  worktreeId,
  title: 'Terminal',
  customTitle: null,
  color: null,
  sortOrder: 0,
  createdAt: 0
})

beforeEach(() => {
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
      'c::/vercel/c': [tab('cloud-shell', 'c::/vercel/c')],
      'r::/repo/w': [tab('mac-shell', 'r::/repo/w')],
      'gone::/x': [tab('orphan', 'gone::/x')]
    } as never,
    lastTerminalInputAtByPaneKey: { 'cloud-shell:leaf': 9_000 },
    agentStatusByPaneKey: {}
  })
})

it('reads a remote shell with the time since the last keypress', () => {
  expect(osc52PaneOrigin('cloud-shell', 'cloud-shell:leaf', 10_000)).toMatchObject({
    source: 'remote-shell',
    sinceTypedMs: 1_000
  })
})

it('keeps a Mac pane local', () => {
  expect(osc52PaneOrigin('mac-shell', 'mac-shell:leaf', 10_000).source).toBe('local')
})

it('fails closed when the tab or its workspace is unknown', () => {
  expect(osc52PaneOrigin('missing', 'missing:leaf', 10_000).source).toBe('remote-stream')
  expect(osc52PaneOrigin('orphan', 'orphan:leaf', 10_000).source).toBe('remote-stream')
})
