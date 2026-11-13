import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  move: vi.fn(),
  activate: vi.fn<() => boolean>(() => true),
  toastError: vi.fn()
}))
const chat = (id: string, entityId: string) => ({
  id,
  entityId,
  contentType: 'agent-session',
  worktreeId: 'w'
})
const state = vi.hoisted(
  (): { unifiedTabsByWorktree: Record<string, Record<string, string>[]> } => ({
    unifiedTabsByWorktree: {}
  })
)
vi.mock('@/store', () => ({ useAppStore: { getState: () => state } }))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('@/components/native-chat/native-chat-composer-draft-store', () => ({
  structuredAgentSessionDraftScopeKey: (sessionId: string) => `scope:${sessionId}`
}))
vi.mock('@/components/native-chat/native-chat-composer-draft-move', () => ({
  moveNativeChatComposerDraft: mocks.move
}))
vi.mock('@/lib/agent-session/structured-agent-session-tab-activation', () => ({
  activateStructuredAgentSessionTab: mocks.activate
}))
vi.mock('@/runtime/structured-agent-session-owner', () => ({
  structuredAgentSessionOwnerForTab: () => 'local'
}))

const { retargetRevioChat } = await import('./revio-chat-send-target')

beforeEach(() => {
  mocks.move.mockReset()
  mocks.activate.mockReset().mockReturnValue(true)
  mocks.toastError.mockReset()
  state.unifiedTabsByWorktree = {
    w: [chat('t1', 's1'), { id: 'term', entityId: 'p', contentType: 'terminal' }, chat('t2', 's2')]
  }
})

describe('retargetRevioChat', () => {
  it('moves the draft to the picked chat and shows that chat', () => {
    expect(retargetRevioChat('w', 't1', 't2')).toBe(true)
    expect(mocks.move).toHaveBeenCalledWith(
      'scope:s1',
      'scope:s2',
      { workspaceId: 'w', executionHostId: 'local' },
      expect.any(Function)
    )
    expect(mocks.activate).toHaveBeenCalledWith({ worktreeId: 'w', tabId: 't2' })
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it('does nothing for the chat already targeted', () => {
    expect(retargetRevioChat('w', 't1', 't1')).toBe(true)
    expect(mocks.move).not.toHaveBeenCalled()
  })

  it('toasts when the target is not a chat or cannot be shown', () => {
    expect(retargetRevioChat('w', 't1', 'term')).toBe(false)
    mocks.activate.mockReturnValue(false)
    expect(retargetRevioChat('w', 't1', 't2')).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledTimes(2)
    expect(mocks.toastError).toHaveBeenCalledWith('Failed to change the message target.')
  })
})
