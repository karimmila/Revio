import { expect, it } from 'vitest'
import { AgentJournalItemBodySchema } from './agent-session-journal-schemas'
import { claudeCompactSummaryText } from './agent-session-compact-summary'

it("reads Claude's compact summary frame, text or blocks", () => {
  expect(
    claudeCompactSummaryText({
      type: 'user',
      isCompactSummary: true,
      message: { content: ' Sum ' }
    })
  ).toBe('Sum')
  expect(
    claudeCompactSummaryText({
      type: 'user',
      isCompactSummary: true,
      message: {
        content: [
          { type: 'text', text: 'A' },
          { type: 'text', text: 'B' }
        ]
      }
    })
  ).toBe('A\nB')
  expect(claudeCompactSummaryText({ type: 'user', message: { content: 'hi' } })).toBeNull()
})

it('a compaction row keeps its summary through the journal schema; older rows without one still parse', () => {
  const row = {
    kind: 'status',
    text: 'Context compacted',
    presentation: 'compaction',
    compactSummary: 'Sum'
  }
  expect(AgentJournalItemBodySchema.parse(row)).toEqual(row)
  const older = { kind: 'status', text: 'Context compacted', presentation: 'compaction' }
  expect(AgentJournalItemBodySchema.parse(older)).toEqual(older)
})
