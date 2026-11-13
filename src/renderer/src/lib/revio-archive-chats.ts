import type { AppState } from '@/store/types'
import { useAppStore } from '@/store'
import { readStructuredChatTabSavedName } from '@/runtime/structured-chat-tab-name'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session/launch/routing/agent-session-launch-plan'
import { newAgentLaunchRequestId } from '@/lib/agent-session/launch/routing/agent-launch-request-id'
import {
  beginStructuredAgentSessionProvisionalLaunch,
  structuredLaunchOwner
} from '@/lib/agent-session/structured-agent-session-provisional-tab'
import {
  openExistingStructuredSession,
  type StructuredSessionOpenOutcome
} from '@/lib/open-existing-structured-session'
import { structuredAgentSessionPaneKey } from '../../../shared/agent-session/view/structured-agent-session-projection'
import { isTuiAgent } from '../../../shared/agent-launch/catalog/tui-agent-config'
import type { ArchivedChat } from '../../../shared/revio-archive-types'
import type { Tab } from '../../../shared/tab-types'

/**
 * The workspace's chats as Unarchive can bring them back: each chat tab's Orca session id, its
 * agent, the provider conversation when the agent reported one (Claude's session id, Codex's
 * thread id), and the name it was given.
 */
export function archivedChatsOf(
  state: Pick<AppState, 'unifiedTabsByWorktree' | 'agentStatusByPaneKey'>,
  worktreeId: string,
  savedNameOf: (tab: Tab) => string | null
): ArchivedChat[] {
  const chats: ArchivedChat[] = []
  const seen = new Set<string>()
  for (const tab of state.unifiedTabsByWorktree[worktreeId] ?? []) {
    if (
      tab.contentType !== 'agent-session' ||
      !isTuiAgent(tab.agentSessionAgent) ||
      seen.has(tab.entityId)
    ) {
      continue
    }
    seen.add(tab.entityId)
    const paneKey = structuredAgentSessionPaneKey(tab.id, tab.entityId)
    const providerSessionId = state.agentStatusByPaneKey[paneKey]?.providerSession?.id
    const title = savedNameOf(tab)
    chats.push({
      agent: tab.agentSessionAgent,
      sessionId: tab.entityId,
      ...(providerSessionId ? { providerSessionId } : {}),
      ...(title ? { title } : {})
    })
  }
  return chats
}

export function archivedChatsInStore(worktreeId: string): ArchivedChat[] {
  const state = useAppStore.getState()
  return archivedChatsOf(state, worktreeId, (tab) => readStructuredChatTabSavedName(tab, state))
}

export type ReopenArchivedChatsDeps = {
  /** Republishes a chat whose host record survived the archive in its workspace. */
  reopen: (workspaceId: string, sessionId: string) => Promise<StructuredSessionOpenOutcome>
  /** Starts a new chat from the provider conversation. */
  resume: (worktreeId: string, chat: ArchivedChat, activate: boolean) => boolean
  wait: (ms: number) => Promise<void>
}

// The restored worktree reaches the host's workspace catalog shortly after create returns.
const REOPEN_ATTEMPTS = 4
const REOPEN_RETRY_MS = 750

async function reopenChat(
  worktreeId: string,
  sessionId: string,
  deps: ReopenArchivedChatsDeps
): Promise<StructuredSessionOpenOutcome> {
  let outcome: StructuredSessionOpenOutcome = 'unavailable'
  for (let attempt = 0; attempt < REOPEN_ATTEMPTS; attempt += 1) {
    outcome = await deps.reopen(worktreeId, sessionId).catch(() => 'unavailable' as const)
    if (outcome !== 'unavailable') {
      return outcome
    }
    await deps.wait(REOPEN_RETRY_MS)
  }
  return outcome
}

/**
 * The Unarchive keeps the workspace's chats. Archiving closes each chat, but its host
 * record stays (history, name, provider conversation) and still holds that conversation, so a
 * new chat adopting the same provider id is refused. A chat restored at its old path therefore
 * reopens its own record; only a chat whose record is gone, or one restored to another
 * workspace (a new branch), resumes from the provider conversation. The first chat ends up
 * shown. Returns how many chats came back or began resuming.
 */
export async function reopenArchivedChats(
  worktreeId: string,
  archivedWorkspaceId: string,
  chats: readonly ArchivedChat[],
  deps: ReopenArchivedChatsDeps = defaultDeps
): Promise<number> {
  let restored = 0
  // Reopened last, the first chat is the one left active.
  for (const [index, chat] of [...chats.entries()].toReversed()) {
    if (chat.sessionId && worktreeId === archivedWorkspaceId) {
      const outcome = await reopenChat(worktreeId, chat.sessionId, deps)
      if (outcome === 'activated') {
        restored += 1
        continue
      }
      if (outcome !== 'gone') {
        continue
      }
    }
    if (chat.providerSessionId && deps.resume(worktreeId, chat, index === 0)) {
      restored += 1
    }
  }
  return restored
}

function resumeFromProvider(worktreeId: string, chat: ArchivedChat, activate: boolean): boolean {
  const owner = structuredLaunchOwner({ route: 'structured-native-chat' }, worktreeId)
  if (!owner || !isTuiAgent(chat.agent) || !chat.providerSessionId) {
    return false
  }
  const plan = adoptAgentSessionLaunchVerdict({
    route: 'structured-native-chat',
    requestId: newAgentLaunchRequestId(),
    agent: chat.agent,
    worktreeId,
    executionHostId: owner.executionHostId,
    resumeFrom: { providerSessionId: chat.providerSessionId }
  })
  const launch = beginStructuredAgentSessionProvisionalLaunch({
    plan,
    hooks: {},
    ...(activate ? {} : { activate: false }),
    onTabOpenSettled: (tabId) => {
      if (tabId && chat.title) {
        useAppStore.getState().setTabCustomTitle(tabId, chat.title, { recordInteraction: false })
      }
    }
  })
  return launch !== null
}

const defaultDeps: ReopenArchivedChatsDeps = {
  reopen: (workspaceId, sessionId) =>
    openExistingStructuredSession({ workspaceId, sessionId }, { present: () => {} }),
  resume: resumeFromProvider,
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}
