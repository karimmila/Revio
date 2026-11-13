import { FilePen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { AgentChatPermissionMode } from '../../../../shared/agent-launch/permissions/agent-chat-permission-mode'

/**
 * The composer toggle "Auto-accept edits": file edits run without asking while it is on.
 * It only flips between asking and accepting edits; a chat on Auto or Full access shows none.
 */
export function autoAcceptEditsToggleState(
  current: string | undefined,
  modes: readonly AgentChatPermissionMode[]
): { on: boolean; next: AgentChatPermissionMode } | null {
  if (!modes.includes('accept-edits') || !modes.includes('ask')) {
    return null
  }
  if (current === 'accept-edits') {
    return { on: true, next: 'ask' }
  }
  return current === 'ask' ? { on: false, next: 'accept-edits' } : null
}

export function NativeChatAutoAcceptEditsToggle({
  on,
  disabled,
  onToggle
}: {
  on: boolean
  disabled: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      aria-pressed={on}
      disabled={disabled}
      data-state={on ? 'on' : 'off'}
      data-native-chat-auto-accept=""
      onClick={onToggle}
    >
      <FilePen className="size-3.5" aria-hidden />
      {translate('components.native-chat.composer.autoAcceptEdits', 'Auto-accept edits')}
    </Button>
  )
}
