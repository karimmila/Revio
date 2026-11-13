// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

type FakeState = {
  tabsByWorktree: Record<string, { id: string }[]>
  terminalLayoutsByTabId: Record<string, { ptyIdsByLeafId: Record<string, string | null> }>
  closeTab: ReturnType<typeof vi.fn>
  repos: never[]
}
const state = vi.hoisted((): FakeState => ({
  tabsByWorktree: {},
  terminalLayoutsByTabId: {},
  closeTab: vi.fn(),
  repos: []
}))
const mocks = vi.hoisted(() => ({
  runInRevioDock: vi.fn<() => string | null>(),
  runQuickCommandInNewTab: vi.fn<() => { tabId: string } | null>(),
  toastError: vi.fn()
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => state } }))
vi.mock('./revio-dock-terminals', () => ({ runInRevioDock: mocks.runInRevioDock }))
vi.mock('@/lib/run-quick-command-in-new-tab', () => ({
  runQuickCommandInNewTab: mocks.runQuickCommandInNewTab
}))
vi.mock('@/lib/cloud-workspaces', () => ({
  cloudEnvironmentIdsNow: () => [],
  isCloudRepo: () => false
}))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('@/components/terminal-pane/pty-transport/delivery/pty-data-sidecar-subscriptions', () => ({
  subscribeToPtyData: () => () => {}
}))

const write = vi.fn()
const hasChildProcesses = vi.fn<(id: string) => Promise<boolean>>()
const snippet = await import('./revio-chat-snippet-run')

beforeEach(() => {
  snippet.resetChatSnippetRunsForTest()
  mocks.runInRevioDock.mockReset()
  mocks.runQuickCommandInNewTab.mockReset()
  mocks.toastError.mockReset()
  write.mockReset()
  hasChildProcesses.mockReset()
  state.closeTab.mockReset()
  state.tabsByWorktree = {}
  state.terminalLayoutsByTabId = {}
  Object.assign(window, { api: { pty: { write, hasChildProcesses } } })
})

describe('snippet helpers', () => {
  it('offers Run on shell fences only', () => {
    expect(['bash', 'sh', 'Shell', 'zsh'].map(snippet.isRunnableSnippetLanguage)).toEqual([
      true,
      true,
      true,
      true
    ])
    expect(snippet.isRunnableSnippetLanguage('typescript')).toBe(false)
    expect(snippet.isRunnableSnippetLanguage(undefined)).toBe(false)
  })

  it('titles the tab with the first line, shortened', () => {
    expect(snippet.snippetTabTitle('  ls -la\npwd')).toBe('ls -la')
    expect(snippet.snippetTabTitle('x'.repeat(40))).toBe(`${'x'.repeat(31)}…`)
  })
})

describe('runChatSnippet', () => {
  it('runs in the dock and records the run', () => {
    mocks.runInRevioDock.mockReturnValue('tab-1')
    expect(snippet.runChatSnippet('w', 'pnpm test\n')).toBe(true)
    expect(mocks.runInRevioDock).toHaveBeenCalledWith('w', 'pnpm test', 'pnpm test')
    expect(snippet.chatSnippetRunForTest(snippet.snippetRunKey('w', 'pnpm test'))?.tabId).toBe(
      'tab-1'
    )
  })

  it('falls back to a tab on the workspace host when the dock cannot run it', () => {
    mocks.runInRevioDock.mockReturnValue(null)
    mocks.runQuickCommandInNewTab.mockReturnValue({ tabId: 'host-tab' })
    expect(snippet.runChatSnippet('w', 'ls')).toBe(true)
    expect(mocks.runQuickCommandInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({
        worktreeId: 'w',
        command: expect.objectContaining({ command: 'ls' })
      })
    )
  })

  it('shows the failure toast when nothing could run it', () => {
    mocks.runInRevioDock.mockReturnValue(null)
    mocks.runQuickCommandInNewTab.mockReturnValue(null)
    expect(snippet.runChatSnippet('w', 'ls')).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith('Failed to run code snippet')
  })
})

describe('stopChatSnippet', () => {
  it('sends ⌃C to the local shell and forgets the run', () => {
    mocks.runInRevioDock.mockReturnValue('tab-1')
    snippet.runChatSnippet('w', 'sleep 9')
    state.terminalLayoutsByTabId = { 'tab-1': { ptyIdsByLeafId: { a: 'pty-1' } } }
    const key = snippet.snippetRunKey('w', 'sleep 9')
    snippet.stopChatSnippet(key)
    expect(write).toHaveBeenCalledWith('pty-1', '\x03', 'driving')
    expect(snippet.chatSnippetRunForTest(key)).toBeUndefined()
  })

  it('closes a tab with no local process', () => {
    mocks.runInRevioDock.mockReturnValue('tab-1')
    snippet.runChatSnippet('w', 'sleep 9')
    state.tabsByWorktree = { w: [{ id: 'tab-1' }] }
    snippet.stopChatSnippet(snippet.snippetRunKey('w', 'sleep 9'))
    expect(state.closeTab).toHaveBeenCalledWith('tab-1')
  })
})

describe('isSnippetStillRunning', () => {
  const run = { tabId: 'tab-1', startedAt: 0 }

  it('ends when the tab is gone', async () => {
    expect(await snippet.isSnippetStillRunning(run, 10_000)).toBe(false)
  })

  it('runs during the start grace, then follows the shell child process', async () => {
    state.tabsByWorktree = { f: [{ id: 'tab-1' }] }
    state.terminalLayoutsByTabId = { 'tab-1': { ptyIdsByLeafId: { a: 'pty-1' } } }
    hasChildProcesses.mockResolvedValue(false)
    expect(await snippet.isSnippetStillRunning(run, 100)).toBe(true)
    expect(await snippet.isSnippetStillRunning(run, 10_000)).toBe(false)
    hasChildProcesses.mockResolvedValue(true)
    expect(await snippet.isSnippetStillRunning(run, 10_000)).toBe(true)
  })
})
