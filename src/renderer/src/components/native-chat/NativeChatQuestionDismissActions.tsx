import { Button } from '@/components/ui/button'
import type { AgentJournalPromptOption } from '../../../../shared/agent-session/journal/agent-session-journal-types'

/** Answers that close a question card without filling it in, such as an MCP form's Decline and
 * Cancel. Unlike the card's X, they answer the request; the turn keeps running. */
export function NativeChatQuestionDismissActions({
  options,
  disabled,
  onChoose
}: {
  options: readonly AgentJournalPromptOption[]
  disabled: boolean
  onChoose: (optionId: string) => void
}): React.JSX.Element {
  return (
    <div data-native-chat-question-dismiss className="mt-2 flex justify-end gap-2">
      {options.map((option) => (
        <Button
          key={option.id}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChoose(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
