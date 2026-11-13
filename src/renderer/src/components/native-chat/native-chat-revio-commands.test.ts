// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { runRevioChatCommand, withLinkedDirectory } from './native-chat-revio-commands'

const call = vi.hoisted(() => vi.fn(async () => ({ requested: true })))
vi.mock('@/runtime/structured-agent-session-client', () => ({ callStructuredAgentSession: call }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

afterEach(() => {
  delete document.documentElement.dataset.revioLayout
  vi.clearAllMocks()
})

const context = { sessionId: 's1', target: { kind: 'local' as const }, worktreeId: null }

it('runs only in the workspace layout, and only its own commands', () => {
  expect(runRevioChatCommand('/mcp-status', context)).toBeNull()
  document.documentElement.dataset.revioLayout = 'true'
  expect(runRevioChatCommand('/compact', context)).toBeNull()
})

it('/mcp-status opens the dialog; /restart asks the host for a fresh agent', async () => {
  document.documentElement.dataset.revioLayout = 'true'
  const openModal = vi.fn()
  useAppStore.setState({ openModal })
  expect(await runRevioChatCommand('/mcp-status', context)).toMatchObject({ handled: true })
  expect(openModal).toHaveBeenCalledWith('chat-mcp-status', {
    sessionId: 's1',
    target: { kind: 'local' }
  })
  expect(await runRevioChatCommand('/restart', context)).toMatchObject({ accepted: true })
  expect(call).toHaveBeenCalledWith({ kind: 'local' }, 'agentSession.restartAgent', {
    sessionId: 's1'
  })
})

it('/add-dir needs a folder, and links each folder once', async () => {
  document.documentElement.dataset.revioLayout = 'true'
  expect(await runRevioChatCommand('/add-dir', context)).toMatchObject({ accepted: false })
  expect(withLinkedDirectory({ '/w': ['/a'] }, '/w', '/a')).toEqual({ '/w': ['/a'] })
  expect(withLinkedDirectory(undefined, '/w', '/b')).toEqual({ '/w': ['/b'] })
})

it('/add-dir alone opens "Link workspaces" for the chat\'s workspace', async () => {
  document.documentElement.dataset.revioLayout = 'true'
  const openModal = vi.fn()
  useAppStore.setState({
    openModal,
    worktreesByRepo: {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test fixture; only the fields this test reads are set
      r: [{ id: 'w1', path: '/w', repoId: 'r', displayName: 'w' } as never]
    }
  })
  const here = { ...context, worktreeId: 'w1' }
  expect(await runRevioChatCommand('/add-dir', here)).toMatchObject({ accepted: true })
  expect(openModal).toHaveBeenCalledWith('chat-link-directories', here)
})
