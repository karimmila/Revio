import { expect, it } from 'vitest'
import type { AgentJournalQuestionItem } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import { readPromptChoice } from './structured-agent-session-turns-prompt'

const form: AgentJournalQuestionItem = {
  kind: 'question',
  question: 'Pick a team',
  options: [],
  questions: [
    {
      id: 'field-0',
      question: 'Team',
      multiSelect: false,
      options: [{ id: 'field-0:eng', label: 'Engineering' }]
    }
  ],
  dismissOptions: [
    { id: 'decline', label: 'Decline' },
    { id: 'cancel', label: 'Cancel' }
  ],
  resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
}

const request = { itemId: 'i', expectedRevision: 1, kind: 'question' as const }

it("a question card's Decline / Cancel reaches the agent as an option", () => {
  expect(readPromptChoice(form, { ...request, optionId: 'decline' })).toEqual({
    response: { kind: 'option', optionId: 'decline' },
    selectedOptionId: 'decline'
  })
})

it('an option the card does not offer is still read as packed answers, and refused', () => {
  expect(readPromptChoice(form, { ...request, optionId: 'accept' })).toBeNull()
  const { dismissOptions: _, ...plain } = form
  expect(readPromptChoice(plain, { ...request, optionId: 'decline' })).toBeNull()
})
