// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NativeChatStructuredQuestionCard } from './NativeChatStructuredQuestionCard'

// The card itself pulls in the code highlighter, which this test does not need.
vi.mock('./NativeChatQuestionCard', () => ({ NativeChatQuestionCard: () => <div /> }))

afterEach(cleanup)

const questions = [
  {
    id: 'field-0',
    question: 'Team',
    multiSelect: false,
    options: [{ id: 'field-0:eng', label: 'Engineering' }]
  }
]

it("answers with the card's Decline / Cancel option, not the turn's stop", () => {
  const onAnswer = vi.fn()
  const onCancel = vi.fn()
  render(
    <NativeChatStructuredQuestionCard
      questions={questions}
      dismissOptions={[
        { id: 'decline', label: 'Decline' },
        { id: 'cancel', label: 'Cancel' }
      ]}
      onAnswer={onAnswer}
      onCancel={onCancel}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
  expect(onAnswer).toHaveBeenCalledWith({ kind: 'option', optionId: 'decline' })
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onAnswer).toHaveBeenLastCalledWith({ kind: 'option', optionId: 'cancel' })
  expect(onCancel).not.toHaveBeenCalled()
})

it('shows no extra actions on an ordinary question', () => {
  render(
    <NativeChatStructuredQuestionCard questions={questions} onAnswer={vi.fn()} onCancel={vi.fn()} />
  )
  expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull()
})
