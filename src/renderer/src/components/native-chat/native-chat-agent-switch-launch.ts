import { useAppStore } from '@/store'
import { launchAgentInNewTab } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-session/launch/routing/agent-launch-request-id'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'

/** A new chat with another agent in the workspace on screen. */
export function launchAgentSwitch(agent: TuiAgent): boolean {
  const worktreeId = useAppStore.getState().activeWorktreeId
  if (!worktreeId) {
    return false
  }
  return Boolean(
    launchAgentInNewTab({
      requestId: newAgentLaunchRequestId(),
      agent,
      worktreeId,
      requestedSurface: 'chat'
    })
  )
}
