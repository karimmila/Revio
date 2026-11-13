import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useRevioLayout } from '@/components/revio-layout/revio-layout'
import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { NativeChatPastChats } from './NativeChatPastChats'
import { NativeChatPastPlans } from './NativeChatPastPlans'

/** The starter prompts on an empty chat; a pick fills the chat input, unsent. */
export function nativeChatEmptySuggestions(): readonly { label: string; prompt: string }[] {
  return [
    {
      label: translate('components.native-chat.emptySuggestions.reviewPrs', 'Review recent PRs'),
      prompt: translate(
        'components.native-chat.emptySuggestions.reviewPrsPrompt',
        'Review the last 10 merged PRs for security risks. Check them one at a time and report findings only after reviewing all 10. Do not edit code.'
      )
    },
    {
      label: translate(
        'components.native-chat.emptySuggestions.instructions',
        'Improve agent instructions'
      ),
      prompt: translate(
        'components.native-chat.emptySuggestions.instructionsPrompt',
        'Create or update the agent instructions for this repo.'
      )
    },
    {
      label: translate('components.native-chat.emptySuggestions.todo', 'Fix a TODO'),
      prompt: translate(
        'components.native-chat.emptySuggestions.todoPrompt',
        'Find a small commented TODO and implement it.'
      )
    }
  ]
}

/** Puts the prompt in this chat's input in place of what it held. */
export function fillChatInput(from: Element, prompt: string): boolean {
  const input = from
    .closest('[data-native-chat-root]')
    ?.querySelector<HTMLElement>('[data-native-chat-composer-scope] [contenteditable="true"]')
  if (!input) {
    return false
  }
  input.focus()
  input.ownerDocument.execCommand('selectAll')
  return input.ownerDocument.execCommand('insertText', false, prompt)
}

/** Puts text at the chat input's caret, keeping what it held. */
function addToChatInput(from: Element, text: string): void {
  const input = from
    .closest('[data-native-chat-root]')
    ?.querySelector<HTMLElement>('[data-native-chat-composer-scope] [contenteditable="true"]')
  if (input) {
    input.focus()
    input.ownerDocument.execCommand('insertText', false, text)
  }
}

export function NativeChatEmptySuggestions(): React.JSX.Element | null {
  const revioLayout = useRevioLayout()
  const workspacePath = useAppStore((state) =>
    state.activeWorktreeId
      ? (findWorktreeById(selectWorktreesByRepo(state), state.activeWorktreeId)?.path ?? null)
      : null
  )
  if (!revioLayout) {
    return null
  }
  return (
    <div className="flex flex-col gap-2">
      <NativeChatPastChats workspacePath={workspacePath} onPick={addToChatInput} />
      <NativeChatPastPlans workspacePath={workspacePath} onPick={addToChatInput} />
      <div data-native-chat-empty-suggestions className="flex flex-wrap justify-center gap-2">
        {nativeChatEmptySuggestions().map(({ label, prompt }) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => fillChatInput(event.currentTarget, prompt)}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  )
}
