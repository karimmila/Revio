// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const chat = (id: string, customLabel: string | null) => ({
  id,
  entityId: `s-${id}`,
  contentType: 'agent-session',
  worktreeId: 'w',
  customLabel
})
const state = vi.hoisted((): { unifiedTabsByWorktree: Record<string, unknown[]> } => ({
  unifiedTabsByWorktree: {}
}))
vi.mock('@/store', () => ({
  useAppStore: (select: (s: typeof state) => unknown): unknown => select(state)
}))
vi.mock('@/runtime/structured-conversation-name', () => ({
  useStructuredChatTabConversationName: () => null
}))
vi.mock('./revio-chat-send-target', async () => ({
  ...(await vi.importActual<object>('./revio-chat-send-target')),
  retargetRevioChat: vi.fn()
}))

const { RevioSendingToPicker } = await import('./RevioSendingToPicker')

beforeEach(() => {
  document.documentElement.dataset.revioLayout = 'true'
})

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.revioLayout
})

describe('RevioSendingToPicker', () => {
  it('shows "Sending to" and the current chat when the workspace has two chats', () => {
    state.unifiedTabsByWorktree = { w: [chat('a', 'Fix login'), chat('b', null)] }
    render(<RevioSendingToPicker tabId="b" worktreeId="w" />)
    expect(screen.getByText('Sending to')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveTextContent('Untitled')
  })

  it('hides with one chat and outside the workspace layout', () => {
    state.unifiedTabsByWorktree = { w: [chat('a', 'Only')] }
    const { rerender } = render(<RevioSendingToPicker tabId="a" worktreeId="w" />)
    expect(screen.queryByText('Sending to')).toBeNull()
    state.unifiedTabsByWorktree = { w: [chat('a', 'One'), chat('b', 'Two')] }
    delete document.documentElement.dataset.revioLayout
    rerender(<RevioSendingToPicker tabId="a" worktreeId="w" />)
    expect(screen.queryByText('Sending to')).toBeNull()
  })
})
