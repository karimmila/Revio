import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { isStructuredTab } from '../../../../shared/agent-session/view/structured-agent-session-tab'
import {
  structuredAgentSessionOwnerForTab,
  structuredAgentSessionTargetForHost
} from '@/runtime/structured-agent-session-owner'
import {
  getStructuredAgentSessionStatusFeed,
  type StructuredAgentSessionStatusFeedOwner
} from '@/runtime/structured-agent-session-status-feed'
import type { AgentSessionStatusSummary } from '../../../../shared/agent-session/agent-session-wire'

/**
 * What a workspace's chats wait on or do, beyond the activity status: the workspace layout's row
 * words.
 */
export type RevioChatPhase = 'question' | 'plan' | 'planning'

type Watched = { feed: StructuredAgentSessionStatusFeedOwner; sessionIds: string[] }

export function revioChatPhase(
  summaries: readonly (AgentSessionStatusSummary | undefined)[]
): RevioChatPhase | null {
  const present = summaries.filter((summary) => summary !== undefined)
  const waiting = present.filter((summary) => summary.status === 'attention')
  if (waiting.some((summary) => summary.attention === 'question')) {
    return 'question'
  }
  if (waiting.some((summary) => summary.attention === 'plan')) {
    return 'plan'
  }
  return present.some(
    (summary) => summary.status === 'working' && summary.interactionMode === 'plan'
  )
    ? 'planning'
    : null
}

/** Reads the host status feeds of this workspace's chats, waking only for their sessions. */
export function useRevioChatPhase(worktreeId: string): RevioChatPhase | null {
  const sessions = useAppStore(
    useShallow((state) =>
      (state.unifiedTabsByWorktree[worktreeId] ?? []).flatMap((tab) =>
        isStructuredTab(tab)
          ? [`${structuredAgentSessionOwnerForTab(state, tab) ?? ''}\n${tab.entityId}`]
          : []
      )
    )
  )
  const watched = useMemo(() => {
    const byOwner = new Map<string, Watched>()
    for (const entry of sessions) {
      const [owner, sessionId] = entry.split('\n')
      const target = owner ? structuredAgentSessionTargetForHost(owner) : null
      if (!target || !sessionId) {
        continue
      }
      const current = byOwner.get(owner) ?? {
        feed: getStructuredAgentSessionStatusFeed(target),
        sessionIds: []
      }
      current.sessionIds.push(sessionId)
      byOwner.set(owner, current)
    }
    return [...byOwner.values()]
  }, [sessions])
  useEffect(() => {
    const releases = watched.map(({ feed }) => feed.activate())
    return () => releases.forEach((release) => release())
  }, [watched])
  const subscribe = useCallback(
    (listener: () => void) => {
      const stops = watched.flatMap(({ feed, sessionIds }) =>
        sessionIds.map((sessionId) => feed.subscribeSession(sessionId, listener))
      )
      return () => stops.forEach((stop) => stop())
    },
    [watched]
  )
  return useSyncExternalStore(
    subscribe,
    () =>
      revioChatPhase(
        watched.flatMap(({ feed, sessionIds }) =>
          sessionIds.map((sessionId) => feed.getSnapshot().get(sessionId))
        )
      ),
    () => null
  )
}
