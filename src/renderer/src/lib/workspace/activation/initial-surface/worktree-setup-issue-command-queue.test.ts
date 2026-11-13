import { beforeEach, describe, expect, it, vi } from 'vitest'

const startInRevioDockInBackground = vi.hoisted(() => vi.fn())
vi.mock('@/components/revio-layout/revio-dock-background-start', () => ({
  startInRevioDockInBackground
}))
vi.mock('../../../setup-runner', () => ({
  buildSetupRunnerCommand: (path: string) => `bash ${path}`
}))

const { queueSetupAndIssueCommands } = await import('./worktree-setup-issue-command-queue')

function fakeStore() {
  return {
    createTab: vi.fn(() => ({ id: 'center-setup' })),
    setActiveTab: vi.fn(),
    setTabCustomTitle: vi.fn(),
    queueTabIssueCommandSplit: vi.fn()
  }
}

const setup = { runnerScriptPath: '/w/.git/orca/setup-runner.sh', envVars: { A: '1' } }

beforeEach(() => startInRevioDockInBackground.mockReset())

describe('queueSetupAndIssueCommands', () => {
  it('runs setup in the bottom panel when the dock takes it', () => {
    startInRevioDockInBackground.mockReturnValue('dock-tab')
    const store = fakeStore()
    // @ts-expect-error the fake store implements only what setup queuing calls
    queueSetupAndIssueCommands(store, 'w', 'chat', setup, undefined, undefined, undefined)
    expect(startInRevioDockInBackground).toHaveBeenCalledWith(
      'w',
      'Setup',
      'bash /w/.git/orca/setup-runner.sh',
      { A: '1' }
    )
    expect(store.createTab).not.toHaveBeenCalled()
  })

  it('keeps the center Setup tab outside the workspace layout', () => {
    startInRevioDockInBackground.mockReturnValue(null)
    const store = fakeStore()
    // @ts-expect-error the fake store implements only what setup queuing calls
    queueSetupAndIssueCommands(store, 'w', 'chat', setup, undefined, undefined, undefined)
    expect(store.createTab).toHaveBeenCalledOnce()
    expect(store.setActiveTab).toHaveBeenCalledWith('chat')
    expect(store.setTabCustomTitle).toHaveBeenCalledWith('center-setup', 'Setup', {
      recordInteraction: false
    })
  })

  it('docks a background create too, since the dock starts setup without being shown', () => {
    startInRevioDockInBackground.mockReturnValue('dock-tab')
    const store = fakeStore()
    queueSetupAndIssueCommands(
      // @ts-expect-error the fake store implements only what setup queuing calls
      store,
      'w',
      null,
      setup,
      undefined,
      undefined,
      { activateCreatedTabs: false }
    )
    expect(startInRevioDockInBackground).toHaveBeenCalledOnce()
    expect(store.createTab).not.toHaveBeenCalled()
  })
})

describe('queueSetupAndIssueCommands for a native-chat create', () => {
  it('docks setup when the workspace is shown after its unactivated tabs open', () => {
    startInRevioDockInBackground.mockReturnValue('dock-tab')
    const store = fakeStore()
    queueSetupAndIssueCommands(
      // @ts-expect-error the fake store implements only what setup queuing calls
      store,
      'w',
      null,
      setup,
      undefined,
      undefined,
      { activateCreatedTabs: false, workspaceShownAfterCreate: true }
    )
    expect(startInRevioDockInBackground).toHaveBeenCalledOnce()
    expect(store.createTab).not.toHaveBeenCalled()
  })
})
