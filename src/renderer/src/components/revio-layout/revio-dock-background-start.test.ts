// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
  state: {} as Record<string, unknown>,
  callRuntimeRpc: vi.fn(),
  claimDockTab: vi.fn(() => 'dock-tab'),
  isRemoteWorkspace: vi.fn(() => false)
}))

vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('@/store/workspace-record-selectors', () => ({ selectWorktreesByRepo: () => ({}) }))
vi.mock('@/store/slices/worktree-helpers', () => ({
  findWorktreeById: (_: unknown, id: string) =>
    id === 'w' ? { id: 'w', repoId: 'r', path: '/repo/w' } : undefined
}))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.callRuntimeRpc }))
vi.mock('./revio-dock-terminals', () => ({
  claimDockTab: mocks.claimDockTab,
  isRemoteWorkspace: mocks.isRemoteWorkspace
}))

const { backgroundDockLine, startInRevioDockInBackground } =
  await import('./revio-dock-background-start')

const CLEAR = `printf '\\033[H\\033[2J\\033[3J'`

function setState(overrides: Record<string, unknown> = {}): void {
  mocks.state = {
    settings: { revioLayout: true },
    repos: [{ id: 'r', connectionId: null }],
    activeWorktreeId: 'w',
    floatingWorkspacePanelOpen: false,
    tabsByWorktree: {},
    createTab: vi.fn(),
    setTabCustomTitle: vi.fn(),
    setActiveTabForWorktree: vi.fn(),
    setFloatingWorkspacePanelOpen: vi.fn(),
    ...overrides
  }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  mocks.callRuntimeRpc.mockReset()
  mocks.claimDockTab.mockClear()
  setState()
})

describe('backgroundDockLine', () => {
  it('clears the echoed launcher line, then runs the command in the folder', () => {
    expect(backgroundDockLine('bash setup.sh', "/repo/it's")).toBe(
      `${CLEAR}; cd '/repo/it'\\''s' && bash setup.sh`
    )
    expect(backgroundDockLine(' ssh -t host', undefined)).toBe(`${CLEAR};  ssh -t host`)
  })
})

describe('startInRevioDockInBackground', () => {
  it('has main start the Setup terminal at once, under the claimed dock tab', async () => {
    mocks.callRuntimeRpc.mockResolvedValue({ terminal: { ptyId: 'pty-1' } })
    expect(startInRevioDockInBackground('w', 'Setup', 'bash setup.sh', { A: '1' })).toBe('dock-tab')
    expect(mocks.claimDockTab).toHaveBeenCalledWith('w', 'Setup')
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'local' },
      'terminal.create',
      {
        worktree: 'id:global-floating-terminal',
        command: `${CLEAR}; cd '/repo/w' && bash setup.sh`,
        env: { A: '1' },
        title: 'Setup',
        tabId: 'dock-tab',
        presentation: 'background'
      },
      { timeoutMs: 30_000 }
    )
    await flush()
    // The panel stays as it was until the adopted tab exists.
    expect(mocks.state.setFloatingWorkspacePanelOpen).not.toHaveBeenCalled()
  })

  it('opens the panel on the adopted tab for the workspace on screen', async () => {
    setState({ tabsByWorktree: { 'global-floating-terminal': [{ id: 'dock-tab' }] } })
    mocks.callRuntimeRpc.mockResolvedValue({ terminal: { ptyId: 'pty-1' } })
    startInRevioDockInBackground('w', 'Setup', 'bash setup.sh')
    await flush()
    expect(mocks.state.setActiveTabForWorktree).toHaveBeenCalledWith(
      'global-floating-terminal',
      'dock-tab'
    )
    expect(mocks.state.setFloatingWorkspacePanelOpen).toHaveBeenCalledWith(true)
  })

  it('keeps the panel as it is when asked not to reveal', async () => {
    setState({ tabsByWorktree: { 'global-floating-terminal': [{ id: 'dock-tab' }] } })
    mocks.callRuntimeRpc.mockResolvedValue({ terminal: { ptyId: 'pty-1' } })
    startInRevioDockInBackground('w', 'Run', 'tail', undefined, { reveal: false })
    await flush()
    expect(mocks.state.setFloatingWorkspacePanelOpen).not.toHaveBeenCalled()
  })

  it('leaves the panel alone for a workspace created in the background', async () => {
    setState({
      activeWorktreeId: 'other',
      tabsByWorktree: { 'global-floating-terminal': [{ id: 'dock-tab' }] }
    })
    mocks.callRuntimeRpc.mockResolvedValue({ terminal: { ptyId: 'pty-1' } })
    startInRevioDockInBackground('w', 'Setup', 'bash setup.sh')
    await flush()
    expect(mocks.state.setFloatingWorkspacePanelOpen).not.toHaveBeenCalled()
  })

  it("falls back to the window's own tab when main refuses", async () => {
    mocks.callRuntimeRpc.mockRejectedValue(new Error('runtime_unavailable'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    startInRevioDockInBackground('w', 'Setup', 'bash setup.sh')
    await flush()
    expect(mocks.state.createTab).toHaveBeenCalledWith(
      'global-floating-terminal',
      undefined,
      undefined,
      {
        id: 'dock-tab',
        activate: false,
        recordInteraction: false,
        startupCwd: '/repo/w',
        pendingStartup: { command: `${CLEAR}; bash setup.sh` }
      }
    )
  })

  it('never runs it twice when main adopted the tab but its reply failed', async () => {
    setState({ tabsByWorktree: { 'global-floating-terminal': [{ id: 'dock-tab' }] } })
    mocks.callRuntimeRpc.mockRejectedValue(new Error('timeout'))
    startInRevioDockInBackground('w', 'Setup', 'bash setup.sh')
    await flush()
    expect(mocks.state.createTab).not.toHaveBeenCalled()
  })

  it('declines outside the workspace layout', () => {
    setState({ settings: { revioLayout: false } })
    expect(startInRevioDockInBackground('w', 'Setup', 'bash setup.sh')).toBeNull()
    expect(mocks.callRuntimeRpc).not.toHaveBeenCalled()
  })
})
