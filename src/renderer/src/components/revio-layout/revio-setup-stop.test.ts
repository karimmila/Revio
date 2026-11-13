// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

type FakeState = {
  tabsByWorktree: Record<string, { id: string; customTitle: string | null }[]>
  terminalLayoutsByTabId: Record<string, { ptyIdsByLeafId: Record<string, string | null> }>
  closeTab: ReturnType<typeof vi.fn>
}
const state = vi.hoisted((): FakeState => ({
  tabsByWorktree: {},
  terminalLayoutsByTabId: {},
  closeTab: vi.fn()
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => state } }))
vi.mock('./revio-dock-terminals', () => ({
  isDockTabForWorkspace: (tabId: string) => tabId === 'dock-setup',
  runInRevioDock: vi.fn()
}))
vi.mock('./revio-dock-background-start', () => ({ startInRevioDockInBackground: vi.fn() }))
vi.mock('@/lib/run-quick-command-in-new-tab', () => ({ runQuickCommandInNewTab: vi.fn() }))
vi.mock('@/lib/cloud-workspaces', () => ({
  cloudEnvironmentIdsNow: () => [],
  isCloudRepo: () => false
}))

const write = vi.fn()
const { stopRevioSetup } = await import('./revio-setup-rerun')

beforeEach(() => {
  write.mockClear()
  state.closeTab.mockClear()
  Object.assign(window, { api: { pty: { write } } })
})

describe('stopRevioSetup', () => {
  it('sends ⌃C to the Setup tabs of the workspace and the dock', () => {
    state.tabsByWorktree = {
      w: [
        { id: 'setup', customTitle: 'Setup' },
        { id: 'shell', customTitle: null }
      ],
      'global-floating-terminal': [{ id: 'dock-setup', customTitle: 'Setup' }]
    }
    state.terminalLayoutsByTabId = {
      setup: { ptyIdsByLeafId: { a: 'pty-1' } },
      'dock-setup': { ptyIdsByLeafId: { b: 'pty-2' } },
      shell: { ptyIdsByLeafId: { c: 'pty-3' } }
    }
    expect(stopRevioSetup('w')).toBe(true)
    expect(write.mock.calls.map((call) => call[0])).toEqual(['pty-1', 'pty-2'])
    expect(write).toHaveBeenCalledWith('pty-1', '\x03', 'driving')
  })

  it('reports false when the workspace runs no setup', () => {
    state.tabsByWorktree = { w: [{ id: 'shell', customTitle: null }] }
    expect(stopRevioSetup('w')).toBe(false)
  })
})
