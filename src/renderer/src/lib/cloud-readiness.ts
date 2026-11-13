import React from 'react'
import type { CloudRepoReadiness } from '../../../shared/cloud/cloud-types'

/**
 * Which of this Mac's GitHub repositories can get a cloud workspace now (Vercel, GitHub token,
 * build), read from main and refreshed when a build or the GitHub connection changes. Shared by
 * the Create composer's Cloud guard and the Cloud Home.
 */
let readiness: ReadonlyMap<string, CloudRepoReadiness> | null = null
const listeners = new Set<() => void>()
let inFlight: Promise<void> | null = null
let watching = false

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function refreshCloudReadiness(): Promise<void> {
  const api = window.api.cloud
  // A renderer reloaded ahead of its preload (dev hot reload) has no readiness call yet.
  if (typeof api?.readiness !== 'function') {
    return Promise.resolve()
  }
  inFlight ??= api
    .readiness()
    .then((entries) => {
      readiness = new Map(entries.map((entry) => [entry.repoId, entry]))
      emit()
    })
    .catch(() => undefined)
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

function watchCloudChanges(): void {
  if (watching || !window.api.cloud) {
    return
  }
  watching = true
  window.api.cloud.onBuildEvent((event) => {
    if (event.build.state !== 'running') {
      void refreshCloudReadiness()
    }
  })
  window.api.cloud.onGithubEvent(() => void refreshCloudReadiness())
}

/** Null until main has answered once. */
export function cloudReadinessNow(): ReadonlyMap<string, CloudRepoReadiness> | null {
  return readiness
}

export function useCloudReadiness(
  enabled: boolean
): ReadonlyMap<string, CloudRepoReadiness> | null {
  React.useEffect(() => {
    if (enabled) {
      watchCloudChanges()
      void refreshCloudReadiness()
    }
  }, [enabled])
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => readiness
  )
}

const LAST_CLOUD_REPO_KEY = 'orca.revio.lastCloudRepoId'

/** The repository the last cloud workspace was made from; a per-Mac convenience only. */
export function lastCloudRepoId(): string | null {
  try {
    return window.localStorage.getItem(LAST_CLOUD_REPO_KEY)
  } catch {
    return null
  }
}

export function rememberCloudRepo(repoId: string): void {
  try {
    window.localStorage.setItem(LAST_CLOUD_REPO_KEY, repoId)
  } catch {
    // Storage can be unavailable; the picker then defaults to the first ready repository.
  }
}
