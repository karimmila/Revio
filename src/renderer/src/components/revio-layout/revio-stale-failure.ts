import { useAppStore } from '@/store'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { WorktreeStatus } from '../../../../shared/worktree-status-rollup'

type StatusEntry = Pick<AgentStatusEntry, 'state' | 'worktreeId' | 'stateStartedAt'> & {
  mainAgent?: { outcome?: string } | null
}

/**
 * Whether a workspace's agent failure is older than later healthy chat activity there: a chat that
 * failed to start (e.g. before an Unarchive fix) must not keep the row on "Failed" once another
 * chat in the workspace has worked or finished cleanly since. A failure with no later healthy
 * activity still shows.
 */
export function failureIsSuperseded(worktreeId: string, entries: readonly StatusEntry[]): boolean {
  let latestFailure = -1
  let latestHealthy = -1
  for (const entry of entries) {
    if (entry.worktreeId !== worktreeId) {
      continue
    }
    const at = entry.stateStartedAt ?? 0
    if (entry.mainAgent?.outcome === 'failure') {
      latestFailure = Math.max(latestFailure, at)
    } else if (entry.state === 'working' || entry.state === 'done') {
      latestHealthy = Math.max(latestHealthy, at)
    }
  }
  return latestFailure >= 0 && latestHealthy > latestFailure
}

/** The row's status with a superseded failure dropped, so the row shows its age instead. */
export function useRevioRowStatus(worktreeId: string, status: WorktreeStatus): WorktreeStatus {
  const superseded = useAppStore(
    (s) =>
      status === 'failed' && failureIsSuperseded(worktreeId, Object.values(s.agentStatusByPaneKey))
  )
  return superseded ? 'done' : status
}
