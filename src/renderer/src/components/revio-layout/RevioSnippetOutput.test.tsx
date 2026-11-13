// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  activeWorktreeId: 'w',
  tabsByWorktree: { f: [{ id: 'tab-1' }] },
  terminalLayoutsByTabId: { 'tab-1': { ptyIdsByLeafId: { a: 'pty-1' } } },
  repos: [{ id: 'r' }],
  closeTab: vi.fn()
}))
const pty = vi.hoisted(() => ({
  watchers: new Map<string, (data: string) => void>(),
  unsubscribe: vi.fn()
}))
vi.mock('@/store', () => {
  const useAppStore = (select: (s: typeof state) => unknown): unknown => select(state)
  useAppStore.getState = () => state
  return { useAppStore }
})
vi.mock('@/store/workspace-record-selectors', () => ({ selectWorktreesByRepo: () => ({}) }))
vi.mock('@/store/slices/worktree-helpers', () => ({ findWorktreeById: () => ({ repoId: 'r' }) }))
vi.mock('./revio-dock-terminals', () => ({ runInRevioDock: () => 'tab-1' }))
vi.mock('@/lib/run-quick-command-in-new-tab', () => ({ runQuickCommandInNewTab: vi.fn() }))
vi.mock('@/lib/cloud-workspaces', () => ({
  cloudEnvironmentIdsNow: () => [],
  isCloudRepo: () => false
}))
vi.mock('@/components/terminal-pane/pty-transport/delivery/pty-data-sidecar-subscriptions', () => ({
  subscribeToPtyData: (id: string, watcher: (data: string) => void) => {
    pty.watchers.set(id, watcher)
    return pty.unsubscribe
  }
}))

const { RevioSnippetOutput } = await import('./RevioSnippetOutput')
const { RevioSnippetRunButton } = await import('./RevioSnippetRunButton')
const { resetChatSnippetRunsForTest } = await import('./revio-chat-snippet-run')
const output = await import('./revio-chat-snippet-output')

beforeEach(() => {
  document.documentElement.dataset.revioLayout = 'true'
  pty.watchers.clear()
  Object.assign(window, {
    api: { pty: { write: vi.fn(), hasChildProcesses: vi.fn().mockResolvedValue(true) } }
  })
})

afterEach(() => {
  cleanup()
  act(() => {
    resetChatSnippetRunsForTest()
    output.resetChatSnippetOutputsForTest()
  })
  vi.clearAllMocks()
  delete document.documentElement.dataset.revioLayout
})

describe('snippet output text', () => {
  it('strips escapes, CRLF and carriage-return redraws', () => {
    expect(output.plainTerminalText('\x1b[32mok\x1b[0m\r\n10%\r50%\r100%\n')).toBe('ok\n100%\n')
  })

  it('drops the prompt and echoed command before, and the prompt after', () => {
    const transcript = 'me@mac app % pnpm test\nPASS 3 tests\nDone\nme@mac app % '
    expect(output.snippetOutputText(transcript, 'pnpm test')).toBe('PASS 3 tests\nDone')
  })

  it('keeps everything when no echo shows, and only the tail of a long run', () => {
    expect(output.snippetOutputText('a\nb', 'ls')).toBe('a\nb')
    const long = 'x'.repeat(output.SNIPPET_OUTPUT_MAX_CHARS + 10)
    expect(output.snippetOutputText(long, 'ls')).toHaveLength(output.SNIPPET_OUTPUT_MAX_CHARS)
  })
})

describe('RevioSnippetOutput', () => {
  it('shows what the run prints under the block, then Clear output removes it', () => {
    render(
      <>
        <RevioSnippetRunButton code="ls" language="bash" />
        <RevioSnippetOutput code="ls" language="bash" />
      </>
    )
    expect(document.querySelector('[data-revio-snippet-output]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    act(() => pty.watchers.get('pty-1')?.('% ls\r\nREADME.md\r\n'))
    expect(screen.getByText('README.md')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear output' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Stop command' }))
    expect(pty.unsubscribe).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Clear output' }))
    expect(document.querySelector('[data-revio-snippet-output]')).toBeNull()
  })

  it('shows nothing for other languages', () => {
    render(<RevioSnippetOutput code="ls" language="python" />)
    expect(document.querySelector('[data-revio-snippet-output]')).toBeNull()
  })
})
