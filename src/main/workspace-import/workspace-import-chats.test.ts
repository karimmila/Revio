import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  rename: vi.fn()
}))

vi.mock(
  '../runtime/rpc/methods/structured-sessions/creation/structured-agent-session-create',
  () => ({
    createStructuredAgentSessionForWorktree: mocks.create
  })
)
vi.mock('../native-chat/agent-session-wire/host/structured-agent-session-registry', () => ({
  getStructuredAgentSessionHost: () => ({ setUserConversationName: mocks.rename })
}))

import { claudeModelForImportedChat, importChat } from './workspace-import-chats'

const CHAT = {
  sourceId: 's1',
  agent: 'claude' as const,
  providerSessionId: '7c930eb6-6d62-47c8-a68f-089997e5aa4e',
  title: 'Stereo audio',
  model: 'opus-5-5-1m',
  lastActivityAt: null
}
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: create and the host are mocked, so the runtime is never read
const runtime = {} as OrcaRuntimeService

beforeEach(() => {
  mocks.create.mockReset()
  mocks.rename.mockReset()
})

describe('importChat', () => {
  it('makes an at-rest chat that resumes the same CLI session, with its model and title', async () => {
    mocks.create.mockResolvedValue({ ok: true, value: { sessionId: 'claude_x' } })
    expect(await importChat(runtime, 'repo::/wt', CHAT)).toEqual({
      ok: true,
      sessionId: 'claude_x'
    })
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        worktree: 'id:repo::/wt',
        agent: 'claude',
        atRest: true,
        activate: false,
        resumeFrom: { providerSessionId: '7c930eb6-6d62-47c8-a68f-089997e5aa4e' },
        options: { model: 'claude-opus-5-5[1m]' },
        optionsMode: 'replace-model-selection'
      })
    )
    expect(mocks.rename).toHaveBeenCalledWith('claude_x', 'Stereo audio', 'rename')
  })

  it('falls back to the default model when the source model is refused', async () => {
    mocks.create
      .mockResolvedValueOnce({ ok: false, refusal: { code: 'agent_session_operation_invalid' } })
      .mockResolvedValueOnce({ ok: true, value: { sessionId: 'claude_y' } })
    expect(await importChat(runtime, 'repo::/wt', CHAT)).toEqual({
      ok: true,
      sessionId: 'claude_y'
    })
    expect(mocks.create.mock.calls[1][0].options).toBeUndefined()
  })
})

describe('claudeModelForImportedChat', () => {
  it('maps the source model names to Claude model ids', () => {
    expect(claudeModelForImportedChat('opus-5-1m')).toBe('claude-opus-5[1m]')
    expect(claudeModelForImportedChat('sonnet-4-5')).toBe('claude-sonnet-4-5')
    expect(claudeModelForImportedChat('gpt-5.6-sol')).toBeNull()
    expect(claudeModelForImportedChat(null)).toBeNull()
  })
})
