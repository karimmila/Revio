import React from 'react'
import { getRepoExecutionHostId, parseExecutionHostId } from '../../../shared/execution-host'
import { VERCEL_CLOUD_RECIPE_ID } from '../../../shared/cloud/cloud-recipe'
import type { EphemeralVmRuntimeRecord } from '../../../shared/ephemeral-vm-runtimes'
import type { Repo } from '../../../shared/repo-types'

/**
 * Which cloud workspaces are asleep: their sandbox is stopped (Sleep, or main's idle stop) and
 * opening the workspace resumes it. Main records this on the sandbox's runtime and sends no event
 * for it, so the list is read again while a cloud row is on screen.
 */
const POLL_MS = 10_000
// A sleep or a wake shows on the runtime a few seconds after it was asked for.
const SOON_MS = [1_000, 3_000, 6_000, 12_000, 25_000]

let asleep: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()
let pollTimer: number | undefined
let soonTimers: number[] = []

/** The environments of cloud sandboxes that are stopped and can be resumed. */
export function asleepCloudEnvironmentIds(
  runtimes: readonly Pick<
    EphemeralVmRuntimeRecord,
    'recipeId' | 'runtimeEnvironmentId' | 'status' | 'cleanupStatus'
  >[]
): Set<string> {
  const ids = new Set<string>()
  for (const runtime of runtimes) {
    if (
      runtime.recipeId === VERCEL_CLOUD_RECIPE_ID &&
      runtime.runtimeEnvironmentId !== undefined &&
      runtime.cleanupStatus !== 'succeeded' &&
      (runtime.status === 'suspended' || runtime.status === 'resume_failed')
    ) {
      ids.add(runtime.runtimeEnvironmentId)
    }
  }
  return ids
}

export async function refreshAsleepCloudEnvironments(): Promise<void> {
  const runtimes = await window.api?.ephemeralVm?.listRuntimes?.().catch(() => null)
  if (!runtimes) {
    return
  }
  const next = asleepCloudEnvironmentIds(runtimes)
  if (next.size === asleep.size && [...next].every((id) => asleep.has(id))) {
    return
  }
  asleep = next
  for (const listener of listeners) {
    listener()
  }
}

/** Reads the list again over the next seconds: call when a sleep or a wake was just asked for. */
export function refreshAsleepCloudEnvironmentsSoon(): void {
  soonTimers.forEach((timer) => window.clearTimeout(timer))
  soonTimers = SOON_MS.map((delay) =>
    window.setTimeout(() => void refreshAsleepCloudEnvironments(), delay)
  )
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (pollTimer === undefined) {
    void refreshAsleepCloudEnvironments()
    pollTimer = window.setInterval(() => void refreshAsleepCloudEnvironments(), POLL_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && pollTimer !== undefined) {
      window.clearInterval(pollTimer)
      pollTimer = undefined
    }
  }
}

/** True while this cloud repository's sandbox is asleep. */
export function useIsCloudRepoAsleep(
  repo: Pick<Repo, 'connectionId' | 'executionHostId'> | null | undefined
): boolean {
  const host = repo ? parseExecutionHostId(getRepoExecutionHostId(repo)) : null
  const environmentId = host?.kind === 'runtime' ? host.environmentId : null
  const read = (): boolean => (environmentId === null ? false : asleep.has(environmentId))
  return React.useSyncExternalStore(subscribe, read, read)
}

export function setAsleepCloudEnvironmentsForTest(ids: readonly string[]): void {
  asleep = new Set(ids)
  for (const listener of listeners) {
    listener()
  }
}
