import type React from 'react'
import { SquarePen } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { TUI_AGENT_DISPLAY_NAMES } from '../../../../shared/agent-launch/catalog/tui-agent-display-names'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'

/** The picker agents. A chat keeps its agent, so another one opens in a new chat. */
export const PICKER_SWITCH_AGENTS: readonly TuiAgent[] = ['claude', 'codex', 'opencode', 'cursor']

export function pickerSwitchAgents(current: string | undefined): readonly TuiAgent[] {
  return PICKER_SWITCH_AGENTS.filter((agent) => agent !== current)
}

export function NativeChatAgentSwitchRows({
  agent,
  onPicked
}: {
  agent: string | undefined
  onPicked: () => void
}): React.JSX.Element {
  const opensNewChat = translate(
    'components.native-chat.agentSwitch.opensNewChat',
    'Opens in new chat'
  )
  return (
    <div data-native-chat-agent-switch className="flex flex-col border-t border-border p-1">
      <div className="px-2 py-1 text-xs text-muted-foreground">
        {translate('components.native-chat.agentSwitch.title', 'Agents')}
      </div>
      {pickerSwitchAgents(agent).map((next) => (
        <Button
          key={next}
          type="button"
          variant="ghost"
          size="xs"
          title={opensNewChat}
          className="w-full justify-start"
          onClick={() => {
            onPicked()
            // Loaded on use: the launch path pulls in the app store, which the picker does not need.
            void import('./native-chat-agent-switch-launch').then((module) =>
              module.launchAgentSwitch(next)
            )
          }}
        >
          <span className="min-w-0 flex-1 truncate text-left">{TUI_AGENT_DISPLAY_NAMES[next]}</span>
          <SquarePen aria-label={opensNewChat} className="size-3 text-muted-foreground" />
        </Button>
      ))}
    </div>
  )
}
