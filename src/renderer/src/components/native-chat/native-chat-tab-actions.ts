import { useEffect, useLayoutEffect, useRef } from 'react'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import type { NativeChatForkSurface } from './use-native-chat-fork'

/** What a chat tab's menu can do with the chat drawn in its pane. */
export type NativeChatTabActions = {
  items: () => readonly AgentJournalRenderItem[]
  /** False where the chat's agent or host can't fork, nothing is forkable yet, or a fork is opening. */
  canFork: () => boolean
  /** Forks through the newest response into a new tab. */
  forkLatest: () => void
}

const byTabId = new Map<string, NativeChatTabActions>()

export function nativeChatTabActions(tabId: string): NativeChatTabActions | null {
  return byTabId.get(tabId) ?? null
}

function latestForkable(
  items: readonly AgentJournalRenderItem[],
  fork: NativeChatForkSurface
): string | null {
  for (let index = items.length - 1; index >= 0; index--) {
    const id = items[index]?.itemId
    if (id && fork.forkableItemIds.has(id)) {
      return id
    }
  }
  return null
}

/** Publishes the mounted chat's transcript and fork to its tab's menu. */
export function useRegisterNativeChatTabActions(
  tabId: string,
  items: readonly AgentJournalRenderItem[],
  fork: NativeChatForkSurface | undefined
): void {
  const latest = useRef({ items, fork })
  useLayoutEffect(() => {
    latest.current = { items, fork }
  })
  useEffect(() => {
    const forkThrough = (): string | null => {
      const current = latest.current
      return current.fork && !current.fork.pending
        ? latestForkable(current.items, current.fork)
        : null
    }
    const actions: NativeChatTabActions = {
      items: () => latest.current.items,
      canFork: () => forkThrough() !== null,
      forkLatest: () => {
        const through = forkThrough()
        if (through) {
          latest.current.fork?.rowAction.request(through)
        }
      }
    }
    byTabId.set(tabId, actions)
    return () => {
      if (byTabId.get(tabId) === actions) {
        byTabId.delete(tabId)
      }
    }
  }, [tabId])
}
