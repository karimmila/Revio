import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { launchAgentInNewTab } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-session/launch/routing/agent-launch-request-id'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import { isTuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent-config'

/** The draft a handed-off plan starts its new chat with. */
export function planHandOffDraft(plan: string, filePath?: string): string {
  const source = filePath ? `\n\n(Plan file: ${filePath})` : ''
  return `${translate('components.native-chat.approval.plan.handOffDraft', 'Implement this plan:')}\n\n${plan.trim()}${source}`
}

/**
 * "Hand off": the plan goes to a new chat as its draft, for the person to send; the
 * caller then stops this chat's turn so the plan is not also run here.
 */
export function handOffPlanToNewChat(
  worktreeId: string,
  agent: string,
  plan: string,
  filePath?: string
): boolean {
  const launched = launchAgentInNewTab({
    requestId: newAgentLaunchRequestId(),
    agent: launchableAgent(agent),
    worktreeId,
    prompt: planHandOffDraft(plan, filePath),
    promptDelivery: 'draft',
    requestedSurface: 'chat'
  })
  if (!launched) {
    toast.error(
      translate('components.native-chat.approval.plan.handOffFailed', 'Failed to hand off plan')
    )
  }
  return Boolean(launched)
}

/** The chat's agent when it launches from a tab; otherwise Claude takes the plan. */
function launchableAgent(agent: string): TuiAgent {
  return isTuiAgent(agent) ? agent : 'claude'
}
