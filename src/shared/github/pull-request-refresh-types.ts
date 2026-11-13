import type { RepoKind } from '../repo-types'
import type { CheckStatus, PRInfo, PRMergeableState, PRState } from './pull-request-types'

/** Classified failures drive stable empty-state copy. Auth/permission/repo_unavailable/gh_unavailable make existing-review lookup impossible and must hide Create. */
export type PRRefreshErrorType =
  | 'rate_limited'
  | 'auth'
  | 'network'
  | 'permission'
  | 'repo_unavailable'
  | 'gh_unavailable'
  | 'server_error'
  // No request ran: Revio has no GitHub App sign-in, or the app is not installed on the owner.
  | 'github_sign_in'
  | 'app_not_installed'
  | 'unknown'

// Backward-compatible name used by outage-copy consumers added on main.
export type PRRefreshUpstreamErrorType = PRRefreshErrorType

export type PRRefreshOutcome =
  | { kind: 'found'; pr: PRInfo; fetchedAt: number }
  | { kind: 'no-pr'; fetchedAt: number; rejectedPRUrls?: string[] }
  | {
      kind: 'upstream-error'
      errorType: PRRefreshErrorType
      message: string
      fetchedAt: number
      // Shared schedule: nextAutoRetryAt is main’s earliest automatic retry; retryDisabledUntil gates manual retry only for rate limits.
      nextAutoRetryAt?: number
      retryDisabledUntil?: number
      /** With `app_not_installed`: the account to install the GitHub App on. */
      installOwner?: string
    }

export type GitHubPRRefreshReason = 'visible' | 'active' | 'post-push' | 'manual' | 'swr'

export type GitHubPRRefreshEnqueueResult =
  | { kind: 'queued' }
  | { kind: 'skipped'; skippedReason: 'validation-denied' | 'validation-backoff' }
  | { kind: 'fallback' }

export type GitHubPRRefreshAlias = {
  cacheKey: string
  repoId?: string
  repoPath: string
  branch: string
  worktreeId?: string
  connectionId?: string | null
  executionHostId?: string | null
  linkedPRNumber?: number | null
  fallbackPRNumber?: number | null
  fallbackPRSource?: 'explicit' | 'pr-cache' | 'hosted-review' | null
  // Carry request-time HEAD so merged PR containment can confirm divergence before consumers clear durable links.
  currentHeadOid?: string | null
}

export type GitHubPRRefreshCandidate = GitHubPRRefreshAlias & {
  repoKind: RepoKind
  repoId: string
  isBare?: boolean
  isArchived?: boolean
  connectionId?: string | null
  executionHostId?: string | null
  connectionState?: 'connected' | 'disconnected' | 'unknown'
  isSelected?: boolean
  /** Workspace layout, selected and GraphQL budget not low: main polls it every 10s. */
  revioSelectedPoll?: boolean
  cachedHeadOid?: string | null
  cachedFetchedAt?: number | null
  cachedHasPR?: boolean | null
  cachedPRState?: PRState | null
  cachedChecksStatus?: CheckStatus | null
  cachedMergeable?: PRMergeableState | null
  cachedMergeStateStatus?: string | null
  localGitOptions?: {
    wslDistro?: string
  }
}

export type GitHubPRRefreshSkippedReason =
  | 'fresh'
  | 'not-git'
  | 'bare'
  | 'archived'
  | 'disconnected'
  /** The workspace's WSL host is off; a poll never starts its distro. */
  | 'host-off'
  | 'remote'
  | 'rate-limit'
  | 'capacity'

type GitHubPRRefreshEventBase = {
  sequence: number
  reason: GitHubPRRefreshReason
  aliases: GitHubPRRefreshAlias[]
  requestStartedAt?: number
}

export type GitHubPRRefreshEvent =
  | (GitHubPRRefreshEventBase & {
      outcome: PRRefreshOutcome
      status?: never
      pausedUntil?: never
      skippedReason?: never
    })
  | (GitHubPRRefreshEventBase & {
      status: 'queued' | 'in-flight'
      outcome?: never
      pausedUntil?: never
      skippedReason?: never
    })
  | (GitHubPRRefreshEventBase & {
      status: 'paused'
      pausedUntil: number
      skippedReason: 'rate-limit'
      outcome?: never
    })
  | (GitHubPRRefreshEventBase & {
      status: 'skipped'
      skippedReason: GitHubPRRefreshSkippedReason
      outcome?: never
      pausedUntil?: never
    })
