import { describe, expect, it } from 'vitest'
import type {
  AgentJournalItemBody,
  AgentJournalRenderItem
} from '../../agent-session/journal/agent-session-journal-types'
import { nativeChatTranscriptCopyText } from './native-chat-transcript-copy'

const row = (sequence: number, body: AgentJournalItemBody): AgentJournalRenderItem => ({
  itemId: `row-${sequence}`,
  sequence,
  revision: 1,
  observedAt: sequence,
  body
})
const text = (role: 'user' | 'assistant' | 'reasoning', value: string): AgentJournalItemBody => ({
  kind: 'message',
  role,
  blocks: [{ type: 'text', text: value }]
})
const items = [
  row(1, text('user', 'Fix the bug')),
  row(2, text('reasoning', 'Look at the parser')),
  row(3, { kind: 'tool-call', name: 'Read', input: { file_path: 'a.ts' }, state: 'completed' }),
  row(4, text('assistant', 'Fixed it.'))
]

describe('nativeChatTranscriptCopyText', () => {
  it('keeps only the messages in a concise transcript', () => {
    expect(nativeChatTranscriptCopyText(items, 'concise')).toBe(
      '## User\n\nFix the bug\n\n## Assistant\n\nFixed it.'
    )
  })

  it('adds reasoning and tool calls to the full one', () => {
    const full = nativeChatTranscriptCopyText(items, 'full')
    expect(full).toContain('## Reasoning\n\nLook at the parser')
    expect(full).toContain('> Tool: Read')
    expect(full.indexOf('> Tool: Read')).toBeLessThan(full.indexOf('## Assistant'))
  })
})
