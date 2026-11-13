// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest'

const callRuntimeRpc = vi.hoisted(() => vi.fn())
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc }))

const { useAppStore } = await import('@/store')
const { startInRevioDockInBackground } = await import('./revio-dock-background-start')
const { isDockTabForWorkspace } = await import('./revio-dock-terminals')
const { FLOATING_TERMINAL_WORKTREE_ID } = await import('../../../../shared/constants')

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** The dock's items for the workspace, as `useRevioDockItems` filters them. */
function dockSetupTabs(worktreeId: string): { id: string; ptyIds: string[] }[] {
  const state = useAppStore.getState()
  return (state.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? [])
    .filter((tab) => tab.customTitle === 'Setup' && isDockTabForWorkspace(tab.id, worktreeId))
    .map((tab) => ({
      id: tab.id,
      ptyIds: Object.values(state.terminalLayoutsByTabId[tab.id]?.ptyIdsByLeafId ?? {}).filter(
        (id): id is string => typeof id === 'string'
      )
    }))
}

beforeEach(() => {
  callRuntimeRpc.mockReset()
  useAppStore.setState({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
    settings: { ...useAppStore.getState().settings, revioLayout: true } as never,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
    repos: [{ id: 'r', path: '/repo', displayName: 'repo', connectionId: null }] as never,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
    worktreesByRepo: { r: [{ id: 'r::/repo/w', repoId: 'r', path: '/repo/w' }] } as never,
    activeWorktreeId: 'other',
    floatingWorkspacePanelOpen: false
  })
})

it("turns the terminal main started in the background into the workspace's Setup dock tab", async () => {
  // Main starts the terminal and replies with its PTY; it reveals no tab for a background create.
  callRuntimeRpc.mockResolvedValue({ terminal: { ptyId: 'pty-setup' } })
  const tabId = startInRevioDockInBackground('r::/repo/w', 'Setup', 'bash setup.sh')
  await flush()
  expect(dockSetupTabs('r::/repo/w')).toEqual([{ id: tabId, ptyIds: ['pty-setup'] }])
  // The pane has nothing to start: it attaches to main's terminal when shown.
  expect(useAppStore.getState().pendingStartupByTabId[tabId ?? '']).toBeUndefined()
  expect(useAppStore.getState().floatingWorkspacePanelOpen).toBe(false)

  useAppStore.setState({ activeWorktreeId: 'r::/repo/w' })
  useAppStore.getState().setFloatingWorkspacePanelOpen(true)
  expect(dockSetupTabs('r::/repo/w')).toEqual([{ id: tabId, ptyIds: ['pty-setup'] }])
})

it("starts a cloud workspace's setup over its ssh route and adopts the Setup dock tab", async () => {
  const { prepareCloudDock } = await import('./revio-cloud-dock')
  const ssh = "ssh -i /k/r1 -o 'IdentitiesOnly=yes' -- ubuntu@sb-1.sandbox"
  Object.assign(window, { api: { cloud: { sshCommand: vi.fn(async () => ssh) } } })
  useAppStore.setState({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
    repos: [
      { id: 'c', path: '/vercel/c', displayName: 'c', executionHostId: 'runtime:env-1' }
    ] as never,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
    worktreesByRepo: { c: [{ id: 'c::/vercel/c', repoId: 'c', path: '/vercel/c' }] } as never
  })
  expect(await prepareCloudDock('env-1')).toBe(true)
  callRuntimeRpc.mockResolvedValue({ terminal: { ptyId: 'pty-cloud' } })
  const tabId = startInRevioDockInBackground(
    'c::/vercel/c',
    'Setup',
    'bash /vercel/.orca-cloud-setup.sh',
    {}
  )
  const [, , params] = callRuntimeRpc.mock.calls[0] ?? []
  expect(params).toMatchObject({
    worktree: 'id:global-floating-terminal',
    title: 'Setup',
    tabId,
    command: expect.stringContaining(
      "-o ServerAliveCountMax=4 -i /k/r1 -o 'IdentitiesOnly=yes' -- ubuntu@sb-1.sandbox"
    )
  })
  await flush()
  expect(dockSetupTabs('c::/vercel/c')).toEqual([{ id: tabId, ptyIds: ['pty-cloud'] }])
})
