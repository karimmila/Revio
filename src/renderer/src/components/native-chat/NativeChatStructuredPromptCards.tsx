import type { RefObject } from 'react'
import { agentSessionPromptQuestions } from '../../../../shared/agent-session/agent-session-question-answer'
import { chatApprovalFromJournal } from '../../../../shared/native-chat/input/native-chat-interactive-prompt'
import { NativeChatApprovalCard } from './NativeChatApprovalCard'
import { NativeChatStructuredQuestionCard } from './NativeChatStructuredQuestionCard'
import { handOffPlanToNewChat } from './native-chat-plan-hand-off'
import type { useStructuredAgentSession } from './use-structured-agent-session'
import type { useStructuredPromptResponseHold } from './use-structured-prompt-response-hold'

type StructuredPrompt = ReturnType<typeof useStructuredAgentSession>['prompts'][number]

export function NativeChatStructuredPromptCards({
  prompt,
  promptResponse,
  onCancel,
  ownerWorktreeId,
  agent,
  shouldFocus,
  answerInputRef
}: {
  prompt: StructuredPrompt | null
  promptResponse: ReturnType<typeof useStructuredPromptResponseHold>
  onCancel: () => void
  ownerWorktreeId: string | null | undefined
  agent: string
  shouldFocus: boolean
  answerInputRef: RefObject<HTMLTextAreaElement | null>
}) {
  if (!prompt) {
    return null
  }
  const approval = prompt.body.kind === 'approval' ? chatApprovalFromJournal(prompt.body) : null
  const questionBody = prompt.body.kind === 'question' ? prompt.body : null
  return (
    <>
      {approval ? (
        <NativeChatApprovalCard
          key={`${prompt.itemId}:${prompt.revision}`}
          approval={approval}
          onChoose={(optionId) => void promptResponse.respond(prompt, { kind: 'option', optionId })}
          isSubmitting={promptResponse.holds(prompt)}
          onCancel={onCancel}
          onHandOffPlan={
            ownerWorktreeId
              ? (plan, filePath) => {
                  if (handOffPlanToNewChat(ownerWorktreeId, agent, plan, filePath)) {
                    onCancel()
                  }
                }
              : undefined
          }
          shouldFocus={shouldFocus}
        />
      ) : null}
      {questionBody ? (
        <NativeChatStructuredQuestionCard
          key={`${prompt.itemId}:${prompt.revision}`}
          questions={agentSessionPromptQuestions(questionBody)}
          dismissOptions={questionBody.dismissOptions}
          onAnswer={(response) => void promptResponse.respond(prompt, response)}
          isSubmitting={promptResponse.holds(prompt)}
          onCancel={onCancel}
          shouldFocus={shouldFocus}
          answerInputRef={answerInputRef}
        />
      ) : null}
    </>
  )
}
