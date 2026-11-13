// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runInRevioDock: vi.fn<() => string | null>(() => 'tab-1'),
  cloud: false
}))
const state = vi.hoisted(() => ({
  activeWorktreeId: 'w',
  tabsByWorktree: { f: [{ id: 'tab-1' }] },
  terminalLayoutsByTabId: { 'tab-1': { ptyIdsByLeafId: { a: 'pty-1' } } },
  repos: [{ id: 'r' }],
  closeTab: vi.fn()
}))
vi.mock('@/store', () => {
  const useAppStore = (select: (s: typeof state) => unknown): unknown => select(state)
  useAppStore.getState = () => state
  return { useAppStore }
})
vi.mock('@/store/workspace-record-selectors', () => ({ selectWorktreesByRepo: () => ({}) }))
vi.mock('@/store/slices/worktree-helpers', () => ({ findWorktreeById: () => ({ repoId: 'r' }) }))
vi.mock('./revio-dock-terminals', () => ({ runInRevioDock: mocks.runInRevioDock }))
vi.mock('@/lib/run-quick-command-in-new-tab', () => ({ runQuickCommandInNewTab: vi.fn() }))
vi.mock('@/components/terminal-pane/pty-transport/delivery/pty-data-sidecar-subscriptions', () => ({
  subscribeToPtyData: () => () => {}
}))
vi.mock('@/lib/cloud-workspaces', () => ({
  cloudEnvironmentIdsNow: () => [],
  isCloudRepo: () => mocks.cloud
}))

const { RevioSnippetRunButton } = await import('./RevioSnippetRunButton')
const { resetChatSnippetRunsForTest } = await import('./revio-chat-snippet-run')

const write = vi.fn()

beforeEach(() => {
  document.documentElement.dataset.revioLayout = 'true'
  mocks.cloud = false
  Object.assign(window, {
    api: { pty: { write, hasChildProcesses: vi.fn().mockResolvedValue(true) } }
  })
})

afterEach(() => {
  cleanup()
  act(() => resetChatSnippetRunsForTest())
  delete document.documentElement.dataset.revioLayout
})

describe('RevioSnippetRunButton', () => {
  it('runs a shell block, then offers Stop command and stops it', () => {
    render(<RevioSnippetRunButton code="pnpm test" language="bash" />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(mocks.runInRevioDock).toHaveBeenCalledWith('w', 'pnpm test', 'pnpm test')
    fireEvent.click(screen.getByRole('button', { name: 'Stop command' }))
    expect(write).toHaveBeenCalledWith('pty-1', '\x03', 'driving')
    expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument()
  })

  it('names the cloud run', () => {
    mocks.cloud = true
    render(<RevioSnippetRunButton code="ls" language="sh" />)
    expect(screen.getByRole('button', { name: 'Run in cloud workspace' })).toBeInTheDocument()
  })

  it('hides for other languages and outside the workspace layout', () => {
    const { rerender } = render(<RevioSnippetRunButton code="ls" language="typescript" />)
    expect(screen.queryByRole('button')).toBeNull()
    delete document.documentElement.dataset.revioLayout
    rerender(<RevioSnippetRunButton code="ls" language="bash" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
