import type { RefObject } from 'react'
import type {
  AgentJournalPromptOption,
  AgentJournalQuestion
} from '../../../../shared/agent-session/journal/agent-session-journal-types'
import type { AgentSessionPromptResponse } from '../../../../shared/agent-session/agent-session-question-answer'
import {
  structuredQuestionAnswers,
  structuredQuestionCard
} from '../../../../shared/structured-agent-question-card'
import { NativeChatQuestionCard } from './NativeChatQuestionCard'
import { NativeChatQuestionDismissActions } from './NativeChatQuestionDismissActions'

export function NativeChatStructuredQuestionCard({
  questions,
  dismissOptions,
  onAnswer,
  onCancel,
  isSubmitting,
  shouldFocus,
  answerInputRef
}: {
  questions: readonly AgentJournalQuestion[]
  /** Card-level answers beside the questions (an MCP form's Decline / Cancel). */
  dismissOptions?: readonly AgentJournalPromptOption[]
  onAnswer: (response: AgentSessionPromptResponse) => void
  onCancel: () => void
  isSubmitting?: boolean
  shouldFocus?: boolean
  answerInputRef?: RefObject<HTMLTextAreaElement | null>
}): React.JSX.Element {
  const card = structuredQuestionCard(questions)
  const questionCard = (
    <NativeChatQuestionCard
      prompt={card.prompt}
      allowOther={card.allowOther}
      freeTextInputs={card.freeTextInputs}
      onAnswer={(selections) => {
        const answers = structuredQuestionAnswers(questions, selections)
        if (answers) {
          onAnswer({ kind: 'answers', answers })
        }
      }}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      shouldFocus={shouldFocus}
      answerInputRef={answerInputRef}
    />
  )
  if (!dismissOptions || dismissOptions.length === 0) {
    return questionCard
  }
  return (
    <div className="flex flex-col">
      {questionCard}
      <NativeChatQuestionDismissActions
        options={dismissOptions}
        disabled={isSubmitting === true}
        onChoose={(optionId) => onAnswer({ kind: 'option', optionId })}
      />
    </div>
  )
}
