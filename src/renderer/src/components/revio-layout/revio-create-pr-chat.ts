import { useAppStore } from '@/store'
import { activateStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import type { Tab } from '../../../../shared/tab-types'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'

/**
 * One "Create PR" chat per workspace. Each click used to open another chat tab, so a failing
 * request stacked tabs; a second click now shows the chat that is already there, and the button
 * waits while that chat works.
 */
type CreatePrChat = { tabId: string | null; startedAt: number }

const START_GRACE_MS = 20_000
const chats = new Map<string, CreatePrChat>()

// Only what is read, so the store and a small test double both fit.
type TabState = {
  unifiedTabsByWorktree: Readonly<
    Record<string, readonly Pick<Tab, 'id' | 'contentType'>[] | undefined>
  >
}
type StatusState = TabState & {
  agentStatusByPaneKey: Readonly<
    Record<string, Pick<AgentStatusEntry, 'paneKey' | 'tabId' | 'state'>>
  >
}

function chatTabIds(state: TabState, worktreeId: string): string[] {
  return (state.unifiedTabsByWorktree[worktreeId] ?? [])
    .filter((tab) => tab.contentType === 'agent-session')
    .map((tab) => tab.id)
}

/** The workspace's open Create PR chat tab, or null once it was closed (or never started). */
export function createPrChatTabId(state: TabState, worktreeId: string): string | null {
  const tabId = chats.get(worktreeId)?.tabId ?? null
  return tabId && chatTabIds(state, worktreeId).includes(tabId) ? tabId : null
}

/**
 * Whether the Create PR chat is at work: its agent reports working or waiting, or it was asked for
 * moments ago and has not reported yet (a chat takes a few seconds to start).
 */
export function createPrChatRunning(state: StatusState, worktreeId: string, now: number): boolean {
  const chat = chats.get(worktreeId)
  if (!chat) {
    return false
  }
  const starting = now - chat.startedAt < START_GRACE_MS
  const tabId = createPrChatTabId(state, worktreeId)
  if (!tabId) {
    return chat.tabId === null && starting
  }
  let reported = false
  for (const entry of Object.values(state.agentStatusByPaneKey)) {
    if ((entry.tabId ?? entry.paneKey.split(':')[0]) !== tabId) {
      continue
    }
    reported = true
    if (entry.state === 'working' || entry.state === 'blocked' || entry.state === 'waiting') {
      return true
    }
  }
  return !reported && starting
}

/** Shows the workspace's Create PR chat when it has one; false when a new chat is needed. */
export function showCreatePrChat(worktreeId: string): boolean {
  const tabId = createPrChatTabId(useAppStore.getState(), worktreeId)
  return tabId !== null && activateStructuredAgentSessionTab({ worktreeId, tabId })
}

/**
 * Starts the chat through `launch` and remembers the tab it opens: the first chat tab the
 * workspace did not have before. A cloud chat's tab arrives after its host answers, so the
 * workspace's tabs are watched until it does.
 */
export function startCreatePrChat(worktreeId: string, launch: () => boolean): boolean {
  const before = new Set(chatTabIds(useAppStore.getState(), worktreeId))
  const chat: CreatePrChat = { tabId: null, startedAt: Date.now() }
  if (!launch()) {
    return false
  }
  chats.set(worktreeId, chat)
  const adopt = (state: TabState): boolean => {
    const opened = chatTabIds(state, worktreeId).find((id) => !before.has(id))
    if (opened) {
      chat.tabId = opened
    }
    return Boolean(opened)
  }
  if (!adopt(useAppStore.getState())) {
    const stop = useAppStore.subscribe((state) => {
      if (adopt(state) || chats.get(worktreeId) !== chat) {
        stop()
      }
    })
    setTimeout(stop, START_GRACE_MS)
  }
  return true
}

export function resetCreatePrChatsForTest(): void {
  chats.clear()
}
