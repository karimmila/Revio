import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))
vi.mock('@/lib/workspace/activation/worktree-activation', () => ({
  activateAndRevealWorktree: vi.fn()
}))
vi.mock('@/components/native-chat/native-chat-composer-draft-store', () => ({
  readNativeChatComposerDraft: () => ({ text: '' }),
  structuredAgentSessionDraftScopeKey: (id: string) => `agent-session:${id}`,
  subscribeToNativeChatComposerDraft: () => () => {}
}))

import { firstDraftedTab } from './RevioOpenDraftButton'

describe('firstDraftedTab', () => {
  it('finds the first chat with unsent text, ignoring whitespace', () => {
    const texts: Record<string, string> = { a: '  ', b: 'fix the bug', c: 'later' }
    const refs = ['a', 'b', 'c'].map((id) => ({ tabId: `tab-${id}`, scopeKey: id }))
    expect(firstDraftedTab(refs, (key) => texts[key] ?? '')).toBe('tab-b')
    expect(firstDraftedTab(refs.slice(0, 1), (key) => texts[key] ?? '')).toBeNull()
  })
})
