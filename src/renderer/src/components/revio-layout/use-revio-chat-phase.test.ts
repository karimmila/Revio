import { describe, expect, it } from 'vitest'
import { revioChatPhase } from './use-revio-chat-phase'
import type { AgentSessionStatusSummary } from '../../../../shared/agent-session/agent-session-wire'

const summary = (fields: Partial<AgentSessionStatusSummary>): AgentSessionStatusSummary => ({
  sessionId: 's',
  workspaceId: 'w',
  agent: 'claude',
  status: 'idle',
  latestPrompt: '',
  updatedAt: 1,
  ...fields
})

describe('revioChatPhase', () => {
  it('puts a question before a plan review before planning', () => {
    const planning = summary({ status: 'working', interactionMode: 'plan' })
    const plan = summary({ status: 'attention', attention: 'plan' })
    const question = summary({ status: 'attention', attention: 'question' })
    expect(revioChatPhase([planning, plan, question])).toBe('question')
    expect(revioChatPhase([planning, plan])).toBe('plan')
    expect(revioChatPhase([planning, undefined])).toBe('planning')
  })

  it('says nothing for a tool approval or default-mode work', () => {
    expect(
      revioChatPhase([
        summary({ status: 'attention', attention: 'approval' }),
        summary({ status: 'working', interactionMode: 'default' })
      ])
    ).toBeNull()
  })
})
