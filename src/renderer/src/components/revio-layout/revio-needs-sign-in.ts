import React from 'react'
import { useAppStore } from '@/store'
import { refreshClaudeLoginRoute, useClaudeLoginRoute } from '@/lib/claude-login-route-store'
import type { ClaudeLoginRoute } from '../../../../shared/claude-login-route'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { WorktreeStatus } from '../../../../shared/worktree-status-rollup'

type StatusEntry = Pick<AgentStatusEntry, 'worktreeId' | 'agentType'> & {
  mainAgent?: { outcome?: string } | null
}

/**
 * Whether a "failed" workspace only failed because Claude is not signed in: nothing went wrong
 * with the work, so the row says "Needs sign-in" in a neutral tone instead of "Failed". A failure
 * of another agent in the workspace keeps "Failed", since signing in to Claude would not fix it.
 */
export function failureNeedsSignIn(
  worktreeId: string,
  status: WorktreeStatus,
  route: ClaudeLoginRoute | null,
  entries: readonly StatusEntry[]
): boolean {
  if (status !== 'failed' || route !== 'none') {
    return false
  }
  return entries.every(
    (entry) =>
      entry.worktreeId !== worktreeId ||
      entry.mainAgent?.outcome !== 'failure' ||
      entry.agentType === undefined ||
      entry.agentType === 'claude'
  )
}

export function useRevioRowNeedsSignIn(worktreeId: string, status: WorktreeStatus): boolean {
  const route = useClaudeLoginRoute()
  // A failure is the moment the answer matters, and the person may have signed in since.
  React.useEffect(() => {
    if (status === 'failed') {
      void refreshClaudeLoginRoute()
    }
  }, [status])
  return useAppStore(
    (s) =>
      status === 'failed' &&
      route === 'none' &&
      failureNeedsSignIn(worktreeId, status, route, Object.values(s.agentStatusByPaneKey))
  )
}
