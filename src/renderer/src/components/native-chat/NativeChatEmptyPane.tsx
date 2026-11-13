import { structuredAgentLabel } from '@/lib/agent-session/launch/structured-agent-session-launch-label'
import type { AgentType } from '../../../../shared/agent-status/contracts/agent-status-types'
import { NativeChatEmptyState } from './NativeChatEmptyState'
import { NativeChatInstallHero } from './NativeChatInstallHero'
import { NativeChatEmptySuggestions } from './NativeChatEmptySuggestions'
import type { NativeChatInstallSlotState } from './NativeChatInstallSlot'

export function NativeChatEmptyPane(props: {
  slot: NativeChatInstallSlotState
  agent: AgentType
}): React.JSX.Element {
  const { slot, agent } = props
  return slot.kind === 'install' ? (
    <NativeChatInstallHero slot={slot} agentLabel={structuredAgentLabel(agent)} />
  ) : (
    <div className="flex h-full w-full flex-col">
      <div className="min-h-0 flex-1">
        <NativeChatEmptyState kind="empty" agent={agent} />
      </div>
      <div className="px-4 pb-2">
        <NativeChatEmptySuggestions />
      </div>
    </div>
  )
}
