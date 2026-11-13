import { describe, expect, it } from 'vitest'
import type {
  AgentJournalItemBody,
  AgentJournalRenderItem
} from '../journal/agent-session-journal-types'
import { projectStructuredAgentSessionStatusState } from './structured-agent-session-projection'

const row = (sequence: number, body: AgentJournalItemBody): AgentJournalRenderItem => ({
  itemId: `row-${sequence}`,
  sequence,
  revision: 1,
  observedAt: sequence,
  body
})
const pending = {
  state: 'pending',
  selectedOptionId: null,
  resolvedBy: null,
  resolvedAt: null
} as const
const asked = [
  row(1, { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'Plan it' }] }),
  row(2, { kind: 'turn', turnId: 'turn', state: 'running' })
]
const approval = (subject?: { kind: 'plan'; text: string }): AgentJournalItemBody => ({
  kind: 'approval',
  title: 'Approve',
  detail: null,
  options: [],
  resolution: pending,
  ...(subject ? { subject } : {})
})

describe('structured agent session attention kind', () => {
  it('names a waiting question', () => {
    const rows = [
      ...asked,
      row(3, { kind: 'question', question: 'Which?', options: [], resolution: pending })
    ]
    expect(projectStructuredAgentSessionStatusState(rows).summary.attention).toBe('question')
  })

  it('tells a plan review from a tool approval', () => {
    const plan = [...asked, row(3, approval({ kind: 'plan', text: 'The plan' }))]
    const tool = [...asked, row(3, approval())]
    expect(projectStructuredAgentSessionStatusState(plan).summary.attention).toBe('plan')
    expect(projectStructuredAgentSessionStatusState(tool).summary.attention).toBe('approval')
  })

  it('leaves a working chat without one', () => {
    expect(projectStructuredAgentSessionStatusState(asked).summary.attention).toBeUndefined()
  })
})
