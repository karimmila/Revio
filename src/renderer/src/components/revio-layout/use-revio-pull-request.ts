import React from 'react'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import type { HostedReviewInfo } from '../../../../shared/source-control/hosted-review/hosted-review-contracts'
import type { GitHubPRStackEntry, PRInfo } from '../../../../shared/github/pull-request-types'
import { getGitHubPRCacheKey } from '../../../../shared/github/github-cache-key'

export type RevioPullRequest = HostedReviewInfo | PRInfo

type AppState = ReturnType<typeof useAppStore.getState>

function activeWorktree(s: AppState) {
  return s.activeWorktreeId
    ? findWorktreeById(selectWorktreesByRepo(s), s.activeWorktreeId)
    : undefined
}

/** The GitHub PR cache entry for a workspace's branch; the one that carries stack data. */
function githubPullRequest(
  s: AppState,
  worktree: ReturnType<typeof activeWorktree> = activeWorktree(s)
): PRInfo | null {
  const repo = worktree ? s.repos.find((candidate) => candidate.id === worktree.repoId) : undefined
  const branch = worktree?.branch.replace(/^refs\/heads\//, '')
  if (!worktree || !repo || !branch) {
    return null
  }
  const key = getGitHubPRCacheKey(
    repo.path,
    repo.id,
    branch,
    s.settings,
    repo.connectionId,
    repo.executionHostId,
    true
  )
  return s.prCache[key]?.data ?? null
}

/**
 * The active workspace's PR, from the same caches the sidebar rows read: the hosted-review cache
 * (the branch's PR, then a PR linked by number), then the GitHub PR cache for the branch, which is
 * the one filled first after a restart.
 */
export function usePullRequestForActiveWorkspace(): RevioPullRequest | null {
  return useAppStore((s) => pullRequestForWorktree(s, activeWorktree(s)))
}

/** A workspace's PR title, for rows that show the name its sidebar row shows. */
export function usePullRequestTitleForWorktree(worktreeId: string): string | null {
  return useAppStore(
    (s) =>
      pullRequestForWorktree(s, findWorktreeById(selectWorktreesByRepo(s), worktreeId))?.title ??
      null
  )
}

function pullRequestForWorktree(
  s: AppState,
  worktree: ReturnType<typeof activeWorktree>
): RevioPullRequest | null {
  if (!worktree) {
    return null
  }
  const branch = worktree.branch.replace(/^refs\/heads\//, '')
  let linked: HostedReviewInfo | null = null
  for (const [key, entry] of Object.entries(s.hostedReviewCache ?? {})) {
    const review = entry?.data
    if (!review || !key.includes(worktree.repoId)) {
      continue
    }
    if (branch && key.endsWith(`::${worktree.repoId}::${branch}`)) {
      return review
    }
    if (review.provider === 'github' && review.number === worktree.linkedPR) {
      linked = review
    }
  }
  return linked ?? githubPullRequest(s, worktree)
}

export type RevioStack = {
  /** Top of the stack first, as the workspace layout lists it. */
  entries: GitHubPRStackEntry[]
  baseRefName: string
  /** The PR this workspace's branch opened. */
  ownNumber: number
}

/** A PR's GitHub-registered stack, top first; null unless it holds more than one PR. */
export function toRevioStack(pr: PRInfo | null): RevioStack | null {
  const entries = pr?.stack?.entries
  if (!pr || !entries || entries.length < 2) {
    return null
  }
  return {
    entries: entries.toSorted((a, b) => b.position - a.position),
    baseRefName: pr.stack?.baseRefName ?? 'main',
    ownNumber: pr.number
  }
}

/** The workspace PR's GitHub stack record, which Merge stack checks and confirms against. */
export function useGitHubPullRequestStack(): PRInfo['stack'] | null {
  return useAppStore((s) => githubPullRequest(s)?.stack ?? null)
}

/** The stack the workspace's PR belongs to, when it has more than one PR. */
export function useRevioStack(): RevioStack | null {
  const pr = useAppStore(githubPullRequest)
  return React.useMemo(() => toRevioStack(pr), [pr])
}

/** The branch a stack entry targets: the PR below it, or the stack's base for the bottom one. */
export function stackEntryBase(stack: RevioStack, entry: GitHubPRStackEntry): string {
  const below = stack.entries.find((candidate) => candidate.position === entry.position - 1)
  return below?.headRefName ?? stack.baseRefName
}

// Which stack PR the workspace is looking at; view state, so it resets on restart.
const selected = new Map<string, number>()
const listeners = new Set<() => void>()
let version = 0

export function selectRevioStackEntry(worktreeId: string, prNumber: number): void {
  selected.set(worktreeId, prNumber)
  version += 1
  for (const listener of listeners) {
    listener()
  }
}

/** The stack entry the PR bar and Changes tab show; the workspace's own PR until another is picked. */
export function useSelectedStackEntry(stack: RevioStack | null): GitHubPRStackEntry | null {
  const worktreeId = useAppStore((s) => s.activeWorktreeId)
  React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version
  )
  if (!stack || !worktreeId) {
    return null
  }
  const number = selected.get(worktreeId) ?? stack.ownNumber
  return (
    stack.entries.find((entry) => entry.number === number) ??
    stack.entries.find((entry) => entry.number === stack.ownNumber) ??
    null
  )
}
