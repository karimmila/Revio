import { useSyncExternalStore } from 'react'
import type { SetupStatus } from '../../../../shared/setup-status'

// Main polls the status files once for every window (setup-status-monitor.ts) and pushes changes.
const statuses = new Map<string, SetupStatus | null>()
const listeners = new Set<() => void>()

export function applySetupStatuses(results: Record<string, SetupStatus | null>): void {
  let changed = false
  for (const [path, next] of Object.entries(results)) {
    if (statuses.get(path) === next && statuses.has(path)) {
      continue
    }
    statuses.set(path, next)
    changed = true
  }
  if (changed) {
    for (const listener of listeners) {
      listener()
    }
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setupStatusOf(worktreePath: string): SetupStatus | null {
  return statuses.get(worktreePath) ?? null
}

/** The sidebar row's setup state: "Setting up…" while running, "Initialization failed" after a failure. */
export function useSetupStatus(worktreePath: string): SetupStatus | null {
  return useSyncExternalStore(subscribe, () => setupStatusOf(worktreePath))
}

export function resetSetupStatusesForTest(): void {
  statuses.clear()
}
