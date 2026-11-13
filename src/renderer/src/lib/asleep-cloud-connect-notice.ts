import { useSyncExternalStore } from 'react'
import type { AsleepCloudWorkspace } from '../../../shared/asleep-cloud-workspace-types'

/**
 * The imported cloud workspace someone tried to open before Vercel was connected. Home shows a
 * card for it: a toast about "creating a cloud workspace" did not match opening one that exists.
 */
let blocked: AsleepCloudWorkspace | null = null
const listeners = new Set<() => void>()

function publish(next: AsleepCloudWorkspace | null): void {
  blocked = next
  for (const listener of listeners) {
    listener()
  }
}

export function showAsleepCloudConnectNotice(record: AsleepCloudWorkspace): void {
  publish(record)
}

export function dismissAsleepCloudConnectNotice(): void {
  if (blocked) {
    publish(null)
  }
}

export function useAsleepCloudConnectNotice(): AsleepCloudWorkspace | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => blocked
  )
}
