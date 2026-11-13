import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'

const STORAGE_KEY = 'orca.revioRecentProjects'
const MAX_RECENTS = 8

export type RecentProject = { path: string; name: string }

function read(): RecentProject[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.flatMap((entry): RecentProject[] =>
          entry &&
          typeof entry === 'object' &&
          'path' in entry &&
          'name' in entry &&
          typeof entry.path === 'string' &&
          typeof entry.name === 'string'
            ? [{ path: entry.path, name: entry.name }]
            : []
        )
      : []
  } catch {
    return []
  }
}

let cache: RecentProject[] | null = null
const listeners = new Set<() => void>()

function snapshot(): RecentProject[] {
  cache ??= read()
  return cache
}

/** Newest first, one entry per folder, at most MAX_RECENTS. */
export function rememberRecentProjects(
  current: readonly RecentProject[],
  seen: readonly RecentProject[]
): RecentProject[] {
  const merged = [...seen, ...current.filter((entry) => !seen.some((s) => s.path === entry.path))]
  return merged.slice(0, MAX_RECENTS)
}

/**
 * Recents the workspace layout lists in Open project: folders opened before that are not open now.
 */
export function closedRecentProjects(
  recents: readonly RecentProject[],
  openPaths: ReadonlySet<string>
): RecentProject[] {
  return recents.filter((entry) => !openPaths.has(entry.path))
}

/** Records every local project this Mac has open, and returns the ones closed since. */
export function useRecentProjects(): RecentProject[] {
  const repos = useAppStore((s) => s.repos)
  const recents = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    snapshot,
    () => []
  )
  const local = useMemo(
    () =>
      repos
        .filter((repo) => !repo.connectionId && repo.executionHostId === 'local')
        .map((repo) => ({ path: repo.path, name: repo.displayName })),
    [repos]
  )
  useEffect(() => {
    const next = rememberRecentProjects(snapshot(), local)
    if (JSON.stringify(next) === JSON.stringify(snapshot())) {
      return
    }
    cache = next
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Without storage the list lasts only this session.
    }
    listeners.forEach((listener) => listener())
  }, [local])
  return useMemo(
    () => closedRecentProjects(recents, new Set(local.map((entry) => entry.path))),
    [local, recents]
  )
}
