import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  startInRevioDockInBackground: vi.fn(),
  queueHookCommandsForFirstWorktreeTab: vi.fn()
}))

vi.mock('@/components/revio-layout/revio-dock-background-start', () => ({
  startInRevioDockInBackground: mocks.startInRevioDockInBackground
}))
vi.mock('@/lib/hook-command-delayed-delivery', () => ({
  queueHookCommandsForFirstWorktreeTab: mocks.queueHookCommandsForFirstWorktreeTab
}))
// A cloud workspace: its terminals belong to its host, which answers for them.
vi.mock('@/lib/workspace-terminal-host-authority', () => ({
  resolveWorkspaceTerminalHostAuthority: () => 'live'
}))

const { ensureWorktreeHasInitialTerminal } = await import('./worktree-initial-terminal-seeding')

const setup = {
  runnerScriptPath: '/vercel/.orca-cloud-setup.sh',
  envVars: {},
  command: 'bash /vercel/.orca-cloud-setup.sh'
}

/** A workspace-layout cloud workspace right after Create: chats only, no terminal tab. */
function cloudStore() {
  return {
    reconcileWorktreeTabModel: () => ({ renderableTabCount: 0 }),
    tabsByWorktree: {},
    settings: { revioLayout: true },
    repos: [],
    worktreesByRepo: {}
  }
}

beforeEach(() => {
  mocks.startInRevioDockInBackground.mockReset()
  mocks.queueHookCommandsForFirstWorktreeTab.mockReset()
})

describe('setup of a cloud workspace created with no terminal tab', () => {
  it('starts in the dock at once instead of waiting for a first terminal tab', () => {
    mocks.startInRevioDockInBackground.mockReturnValue('dock-setup')
    ensureWorktreeHasInitialTerminal(
      // @ts-expect-error the fake store implements only what seeding reads on this path
      cloudStore(),
      'cw',
      undefined,
      setup,
      undefined,
      undefined,
      { activateCreatedTabs: false }
    )
    expect(mocks.startInRevioDockInBackground).toHaveBeenCalledWith(
      'cw',
      'Setup',
      'bash /vercel/.orca-cloud-setup.sh',
      {}
    )
    expect(mocks.queueHookCommandsForFirstWorktreeTab).not.toHaveBeenCalled()
  })

  it('still waits for the first tab when the dock cannot take it', () => {
    mocks.startInRevioDockInBackground.mockReturnValue(null)
    ensureWorktreeHasInitialTerminal(
      // @ts-expect-error the fake store implements only what seeding reads on this path
      cloudStore(),
      'cw',
      undefined,
      setup,
      undefined,
      undefined,
      { activateCreatedTabs: false }
    )
    expect(mocks.queueHookCommandsForFirstWorktreeTab).toHaveBeenCalledOnce()
  })
})
