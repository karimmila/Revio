import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { structuredAgentSessionDraftScopeKey } from '@/components/native-chat/native-chat-composer-draft-store'
import { moveNativeChatComposerDraft } from '@/components/native-chat/native-chat-composer-draft-move'
import { activateStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { structuredAgentSessionOwnerForTab } from '@/runtime/structured-agent-session-owner'
import type { Tab } from '../../../../shared/tab-types'

/** The workspace's chat tabs, in tab order: the targets "Sending to" offers. */
export function workspaceChatTabs(tabs: readonly Tab[] | undefined): Tab[] {
  return (tabs ?? []).filter((tab) => tab.contentType === 'agent-session')
}

/**
 * "Sending to": the unsent draft moves to the picked chat and that chat comes on screen, so the
 * next send goes to it. Shows the workspace layout's toast when the target cannot be reached.
 */
export function retargetRevioChat(
  worktreeId: string,
  sourceTabId: string,
  targetTabId: string
): boolean {
  if (sourceTabId === targetTabId) {
    return true
  }
  try {
    const state = useAppStore.getState()
    const chats = workspaceChatTabs(state.unifiedTabsByWorktree[worktreeId])
    const source = chats.find((tab) => tab.id === sourceTabId)
    const target = chats.find((tab) => tab.id === targetTabId)
    if (!source || !target) {
      throw new Error('chat tab not found')
    }
    const executionHostId = structuredAgentSessionOwnerForTab(state, target)
    moveNativeChatComposerDraft(
      structuredAgentSessionDraftScopeKey(source.entityId),
      structuredAgentSessionDraftScopeKey(target.entityId),
      executionHostId ? { workspaceId: worktreeId, executionHostId } : undefined,
      () => ({ at: 'end', target: target.id, pending: true })
    )
    if (!activateStructuredAgentSessionTab({ worktreeId, tabId: target.id })) {
      throw new Error('chat tab not activated')
    }
    return true
  } catch {
    toast.error(
      translate(
        'auto.components.revioLayout.sendTargetFailed',
        'Failed to change the message target.'
      )
    )
    return false
  }
}
