import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: vi.fn() }))
vi.mock('@/components/new-workspace/ProjectCombobox', () => ({ default: () => null }))
vi.mock('./WorkspacePromptInput', () => ({ WorkspacePromptInput: () => null }))
vi.mock('./NewWorkspaceComposerAgentSection', () => ({
  NewWorkspaceComposerAgentSection: () => null
}))
vi.mock('./NewWorkspaceComposerAdvancedSection', () => ({
  NewWorkspaceComposerAdvancedSection: () => null
}))
vi.mock('./NewWorkspaceComposerNameSection', () => ({
  NewWorkspaceComposerNameSection: () => null
}))
vi.mock('./CloudCreateReadiness', () => ({ CloudCreateReadiness: () => null }))
vi.mock('@/components/native-chat/NativeChatSessionOptionPickers', () => ({
  NativeChatSessionOptionPickers: () => null
}))

import { composerModelReason } from './RevioComposerBody'

describe('the Create card model pill', () => {
  it('says why it is disabled while Claude has no login on this Mac', () => {
    expect(composerModelReason('claude', 'none')).toBe('Sign in to Claude to choose a model')
  })

  it('gives no reason once signed in, while unknown, or for another agent', () => {
    expect(composerModelReason('claude', 'system')).toBeUndefined()
    expect(composerModelReason('claude', null)).toBeUndefined()
    expect(composerModelReason('codex', 'none')).toBeUndefined()
  })
})
