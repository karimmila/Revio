import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'orca.revioViewedFiles'

/** Viewed files per workspace, each with the change it was viewed at ("Viewed"). */
type Viewed = Record<string, Record<string, string>>

let viewed: Viewed | null = null
const listeners = new Set<() => void>()

function load(): Viewed {
  if (viewed) {
    return viewed
  }
  const parsed: Viewed = {}
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    for (const [worktreeId, files] of Object.entries(stored ?? {})) {
      if (!files || typeof files !== 'object') {
        continue
      }
      parsed[worktreeId] = Object.fromEntries(
        Object.entries(files).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string'
        )
      )
    }
  } catch {
    // Unreadable marks start empty.
  }
  viewed = parsed
  return viewed
}

function save(next: Viewed): void {
  viewed = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Viewed marks are a per-viewer convenience; without storage they last this run.
  }
  for (const listener of listeners) {
    listener()
  }
}

/** A file counts as viewed only while its change is the one that was viewed. */
export function diffChangeSignature(added: number, removed: number): string {
  return `${added}:${removed}`
}

export function isDiffFileViewed(worktreeId: string, path: string, signature: string): boolean {
  return load()[worktreeId]?.[path] === signature
}

export function toggleDiffFileViewed(worktreeId: string, path: string, signature: string): boolean {
  const current = load()
  const files = { ...current[worktreeId] }
  const nowViewed = files[path] !== signature
  if (nowViewed) {
    files[path] = signature
  } else {
    delete files[path]
  }
  save({ ...current, [worktreeId]: files })
  return nowViewed
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDiffFileViewed(
  worktreeId: string | null | undefined,
  path: string,
  signature: string
): boolean {
  return useSyncExternalStore(subscribe, () =>
    worktreeId ? isDiffFileViewed(worktreeId, path, signature) : false
  )
}
