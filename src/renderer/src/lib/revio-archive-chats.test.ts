import { describe, expect, it, vi } from 'vitest'
import { structuredAgentSessionPaneKey } from '../../../shared/agent-session/view/structured-agent-session-projection'
import type { ReopenArchivedChatsDeps } from './revio-archive-chats'

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))
vi.mock('@/runtime/structured-chat-tab-name', () => ({
  readStructuredChatTabSavedName: () => null
}))
vi.mock('@/lib/agent-session/launch/routing/agent-session-launch-plan', () => ({
  adoptAgentSessionLaunchVerdict: vi.fn()
}))
vi.mock('@/lib/agent-session/structured-agent-session-provisional-tab', () => ({
  beginStructuredAgentSessionProvisionalLaunch: vi.fn(),
  structuredLaunchOwner: vi.fn()
}))
vi.mock('@/lib/open-existing-structured-session', () => ({
  openExistingStructuredSession: vi.fn()
}))

const { archivedChatsOf, reopenArchivedChats } = await import('./revio-archive-chats')

function chatTab(id: string, entityId: string, agent: string) {
  return { id, entityId, contentType: 'agent-session', agentSessionAgent: agent, label: 'Chat' }
}

describe('archivedChatsOf', () => {
  it("keeps each chat tab's session id, agent, reported conversation and saved name", () => {
    const tabs = [
      chatTab('t1', 's1', 'claude'),
      chatTab('t2', 's2', 'codex'),
      { id: 'term', entityId: 'term', contentType: 'terminal', label: 'Terminal' }
    ]
    const state = {
      unifiedTabsByWorktree: { w: tabs },
      agentStatusByPaneKey: {
        [structuredAgentSessionPaneKey('t1', 's1')]: { providerSession: { id: 'claude-1' } }
      }
    }
    const chats = archivedChatsOf(
      // @ts-expect-error the fake state carries only the fields chats are read from
      state,
      'w',
      (tab: { id: string }) => (tab.id === 't1' ? 'Say ok and stop' : null)
    )
    expect(chats).toEqual([
      { agent: 'claude', sessionId: 's1', providerSessionId: 'claude-1', title: 'Say ok and stop' },
      { agent: 'codex', sessionId: 's2' }
    ])
  })
})

function deps(outcomes: Record<string, string[]>): ReopenArchivedChatsDeps & {
  reopened: string[]
  resumed: string[]
} {
  const reopened: string[] = []
  const resumed: string[] = []
  return {
    reopened,
    resumed,
    // @ts-expect-error outcomes are the open outcomes the host can reply with
    reopen: async (_workspace, sessionId) => {
      reopened.push(sessionId)
      return outcomes[sessionId]?.shift() ?? 'activated'
    },
    resume: (_worktree, chat) => {
      resumed.push(chat.providerSessionId ?? '')
      return true
    },
    wait: async () => {}
  }
}

const chat = { agent: 'claude', sessionId: 'claude_ae570c05', providerSessionId: '725619d6' }

describe('reopenArchivedChats', () => {
  it('reopens the chat by its own record at the same path, never adopting its conversation', async () => {
    // Adopting 725619d6 in a new chat is what failed live: the archived chat's record still holds it.
    const fake = deps({})
    expect(await reopenArchivedChats('repo::/w', 'repo::/w', [chat], fake)).toBe(1)
    expect(fake.reopened).toEqual(['claude_ae570c05'])
    expect(fake.resumed).toEqual([])
  })

  it('retries while the restored workspace is not on the host yet', async () => {
    const fake = deps({ claude_ae570c05: ['unavailable', 'unavailable'] })
    expect(await reopenArchivedChats('repo::/w', 'repo::/w', [chat], fake)).toBe(1)
    expect(fake.reopened).toHaveLength(3)
  })

  it('resumes from the provider conversation only when the record is gone or the path moved', async () => {
    const gone = deps({ claude_ae570c05: ['gone'] })
    await reopenArchivedChats('repo::/w', 'repo::/w', [chat], gone)
    expect(gone.resumed).toEqual(['725619d6'])
    const moved = deps({})
    await reopenArchivedChats('repo::/w-restored', 'repo::/w', [chat], moved)
    expect(moved.reopened).toEqual([])
    expect(moved.resumed).toEqual(['725619d6'])
  })

  it('reopens the first chat last so it is the one shown', async () => {
    const fake = deps({})
    await reopenArchivedChats(
      'repo::/w',
      'repo::/w',
      [chat, { agent: 'codex', sessionId: 'codex_2' }],
      fake
    )
    expect(fake.reopened).toEqual(['codex_2', 'claude_ae570c05'])
  })
})
