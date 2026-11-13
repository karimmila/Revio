import { useSyncExternalStore } from 'react'
import type { AsleepCloudWorkspace } from '../../../shared/asleep-cloud-workspace-types'

/**
 * Imported cloud workspaces that have no sandbox yet, as the sidebar's Cloud list shows them.
 * One being woken is left out: its creation row stands in for it until it is a real workspace.
 */
let records: readonly AsleepCloudWorkspace[] = []
let visible: readonly AsleepCloudWorkspace[] = []
const waking = new Set<string>()
const listeners = new Set<() => void>()
let started = false

function publish(): void {
  visible = records.filter((record) => !waking.has(record.id))
  for (const listener of listeners) {
    listener()
  }
}

export async function refreshAsleepCloudWorkspaces(): Promise<void> {
  const listed = await window.api?.workspaceImport?.asleepList().catch(() => null)
  if (listed) {
    records = listed
    publish()
  }
}

function start(): void {
  if (started) {
    return
  }
  started = true
  window.api?.workspaceImport?.onAsleepChanged(() => void refreshAsleepCloudWorkspaces())
  void refreshAsleepCloudWorkspaces()
}

function subscribe(listener: () => void): () => void {
  start()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAsleepCloudWorkspaces(): readonly AsleepCloudWorkspace[] {
  return useSyncExternalStore(subscribe, () => visible)
}

/** False when it is already waking, so a second click does not start a second sandbox. */
export function markAsleepCloudWaking(id: string): boolean {
  if (waking.has(id)) {
    return false
  }
  waking.add(id)
  publish()
  return true
}

export function clearAsleepCloudWaking(id: string): void {
  if (waking.delete(id)) {
    publish()
  }
}

/** Test seam. */
export function setAsleepCloudWorkspacesForTest(next: readonly AsleepCloudWorkspace[]): void {
  records = next
  waking.clear()
  publish()
}
