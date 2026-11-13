import { translate } from '@/i18n/i18n'
import type {
  PRMergeableState,
  PRReviewDecision,
  PRState
} from '../../../../shared/github/pull-request-types'

/** The fields the header reads, shared by a workspace's own PR and the other PRs of its stack. */
export type PrLike = {
  number: number
  title: string
  url: string
  state: PRState
  mergeable: PRMergeableState
  reviewDecision?: PRReviewDecision | null
  /** A CheckStatus for GitHub; other hosts report their own words. */
  checks: string
  /** GitHub's mergeStateStatus (CLEAN, BLOCKED, BEHIND, DIRTY, UNSTABLE…), when known. */
  mergeStateStatus?: string | null
  /** Set to merge when ready; with a required merge queue, the PR waits in that queue. */
  autoMergeEnabled?: boolean
  mergeQueueRequired?: boolean | null
}

export type PrTone = 'merged' | 'open' | 'attention' | 'quiet' | 'ready'
export type PrAction = 'fixErrors' | 'resolveConflicts' | 'commitAndPush' | 'merge' | null

/**
 * The one-line status beside the PR chip, most urgent first, with its one-click fix
 * (its 0.92 header: Merged, Closed, Draft, Merge conflicts, Checks failing, Uncommitted changes,
 * Checks pending, Changes requested, PR review required, Blocked, Ready to merge).
 */
export function describePullRequest(
  pr: PrLike,
  uncommitted: number,
  /** "Treat optional checks as blocking"; off, only required checks hold the PR. */
  optionalChecksBlocking = false
): { label: string; tone: PrTone; action: PrAction; checksPending?: true } {
  // GitHub reports UNSTABLE when only checks it does not require are failing or pending.
  const checks =
    !optionalChecksBlocking && pr.mergeStateStatus === 'UNSTABLE' ? 'success' : pr.checks
  if (pr.state === 'merged') {
    return {
      label: translate('auto.components.revioLayout.prMerged', 'Merged'),
      tone: 'merged',
      action: null
    }
  }
  if (pr.state === 'closed') {
    return {
      label: translate('auto.components.revioLayout.prClosed', 'Closed'),
      tone: 'quiet',
      action: null
    }
  }
  if (pr.state === 'draft') {
    return {
      label: translate('auto.components.revioLayout.prDraft', 'Draft'),
      tone: 'quiet',
      action: null
    }
  }
  if (pr.autoMergeEnabled && pr.mergeQueueRequired) {
    return {
      label: translate('auto.components.revioLayout.prQueued', 'Queued'),
      tone: 'ready',
      action: null
    }
  }
  if (pr.mergeable === 'CONFLICTING' || pr.mergeStateStatus === 'DIRTY') {
    const label = translate('auto.components.revioLayout.prMergeConflicts', 'Merge conflicts')
    return { label, tone: 'attention', action: 'resolveConflicts' }
  }
  if (checks === 'failure') {
    return {
      label: translate('auto.components.revioLayout.prChecksFailing', 'Checks failing'),
      tone: 'attention',
      action: 'fixErrors'
    }
  }
  if (uncommitted > 0) {
    const label = translate('auto.components.revioLayout.prUncommitted', 'Uncommitted changes')
    return { label, tone: 'open', action: 'commitAndPush' }
  }
  if (checks === 'pending') {
    return {
      label: translate('auto.components.revioLayout.prChecksPending', 'Checks pending'),
      tone: 'open',
      action: null,
      checksPending: true
    }
  }
  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
    return {
      label: translate('auto.components.revioLayout.prChangesRequested', 'Changes requested'),
      tone: 'open',
      action: null
    }
  }
  if (pr.reviewDecision === 'REVIEW_REQUIRED') {
    return {
      label: translate('auto.components.revioLayout.prReviewRequired', 'PR review required'),
      tone: 'open',
      action: null
    }
  }
  if (pr.mergeStateStatus === 'BLOCKED') {
    return {
      label: translate('auto.components.revioLayout.prBlocked', 'Blocked'),
      tone: 'open',
      action: null
    }
  }
  if (pr.mergeable === 'MERGEABLE') {
    return {
      label: translate('auto.components.revioLayout.prReadyToMerge', 'Ready to merge'),
      tone: 'ready',
      action: 'merge'
    }
  }
  if (pr.reviewDecision === 'APPROVED') {
    return {
      label: translate('auto.components.revioLayout.prApproved', 'Approved'),
      tone: 'open',
      action: null
    }
  }
  return {
    label: translate('auto.components.revioLayout.prReviewRequired', 'PR review required'),
    tone: 'open',
    action: null
  }
}

/**
 * The Automerge (Settings > Git): while checks are pending, an "Automerge" button, or
 * "Disable auto-merge" once it is on. Not for stacked PRs, or when GitHub's repository setting
 * does not allow auto-merge.
 */
export function revioAutoMergeMode({
  enabledInSettings,
  checksPending,
  autoMergeEnabled,
  autoMergeAllowed,
  stacked,
  provider
}: {
  enabledInSettings: boolean
  checksPending: boolean
  autoMergeEnabled: boolean | undefined
  autoMergeAllowed: boolean | null | undefined
  stacked: boolean
  provider: string | undefined
}): 'enable' | 'disable' | null {
  if (!enabledInSettings || !checksPending || stacked || (provider && provider !== 'github')) {
    return null
  }
  if (autoMergeEnabled) {
    return 'disable'
  }
  return autoMergeAllowed === false ? null : 'enable'
}
