import React from 'react'
import type {
  GitHistoryItem,
  GitHistoryResult
} from '../../../../shared/git/history/git-history-types'

const MAX_COMMITS = 20

/** The branch's own commits: newest first, stopping at the merge base with the target branch. */
export function branchCommits(result: GitHistoryResult | undefined): GitHistoryItem[] {
  if (!result) {
    return []
  }
  const commits: GitHistoryItem[] = []
  for (const item of result.items) {
    if (item.id === result.mergeBase || commits.length === MAX_COMMITS) {
      break
    }
    commits.push(item)
  }
  return result.mergeBase ? commits : []
}

type BranchCommits = {
  commits: GitHistoryItem[]
  loading: boolean
  open: (item: GitHistoryItem) => void
}

const EMPTY: BranchCommits = { commits: [], loading: false, open: () => {} }
let current: BranchCommits = EMPTY
const listeners = new Set<() => void>()
const requestListeners = new Set<() => void>()

/** The Changes panel publishes the branch's commits for the Changes "⋮" menu. */
export function publishRevioBranchCommits(next: BranchCommits): void {
  current = next
  for (const listener of listeners) {
    listener()
  }
}

export function useRevioBranchCommits(): BranchCommits {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current
  )
}

/** The menu opened: ask the Changes panel to load commits (they load only on demand). */
export function requestRevioBranchCommits(): void {
  for (const listener of requestListeners) {
    listener()
  }
}

/** Wires the Changes panel's history to the menu: loads on request and publishes the list. */
export function useRevioBranchCommitsBridge({
  enabled,
  historyCollapsed,
  expandHistory,
  result,
  loading,
  open
}: {
  enabled: boolean
  historyCollapsed: boolean
  expandHistory: () => void
  result: GitHistoryResult | undefined
  loading: boolean
  open: (item: GitHistoryItem) => void
}): void {
  const expandRef = React.useRef({ historyCollapsed, expandHistory })
  expandRef.current = { historyCollapsed, expandHistory }
  React.useEffect(() => {
    if (!enabled) {
      return
    }
    const listener = (): void => {
      // The workspace layout hides Commits, so expanding it only starts the history read.
      if (expandRef.current.historyCollapsed) {
        expandRef.current.expandHistory()
      }
    }
    requestListeners.add(listener)
    return () => {
      requestListeners.delete(listener)
    }
  }, [enabled])
  const commits = React.useMemo(() => branchCommits(result), [result])
  React.useEffect(() => {
    if (enabled) {
      publishRevioBranchCommits({ commits, loading, open })
    }
  }, [enabled, commits, loading, open])
  React.useEffect(
    () => () => {
      publishRevioBranchCommits(EMPTY)
    },
    []
  )
}
