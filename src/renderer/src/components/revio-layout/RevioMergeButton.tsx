import React from 'react'
import { GitMerge, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import {
  mergeGitHubHostedReview,
  setGitHubHostedReviewAutoMerge
} from '@/components/right-sidebar/hosted-review/provider-actions/hosted-review-github-actions'
import { revioMergeMethod } from '../../../../shared/github/pull-request-merge-methods'
import type {
  GitHubPRMergeMethodSettings,
  GitHubPRStack
} from '../../../../shared/github/pull-request-types'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { buildGitHubPRStackMergeConfirmation } from '@/components/right-sidebar/hosted-review/provider-actions/github-pr-stack-confirmation'
import {
  getGitHubPRStackMergeBlocker,
  getGitHubPRStackMergeScope
} from '@/components/right-sidebar/hosted-review/provider-actions/github-pr-stack-merge'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'

export type MergeablePr = {
  number: number
  provider?: string
  mergeMethodSettings?: GitHubPRMergeMethodSettings
  /** A queued merge has not landed yet, so it never archives the workspace. */
  mergeQueueRequired?: boolean | null
}

const merging = new Set<number>()

/** Merges the workspace's PR with the repository's default method (Orca's GitHub merge). */
export async function mergeRevioPullRequest(pr: MergeablePr): Promise<void> {
  const state = useAppStore.getState()
  const worktree = state.activeWorktreeId
    ? findWorktreeById(selectWorktreesByRepo(state), state.activeWorktreeId)
    : undefined
  const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
  if (!repo || merging.has(pr.number) || (pr.provider && pr.provider !== 'github')) {
    return
  }
  merging.add(pr.number)
  try {
    const result = await mergeGitHubHostedReview({
      repo,
      prNumber: pr.number,
      method: revioMergeMethod(pr.mergeMethodSettings),
      // The workspace layout merges only the commit the workspace has; a PR that moved on is
      // refused.
      ...(worktree?.head ? { matchHeadCommit: worktree.head } : {})
    })
    // Archive on merge follows the PR turning merged (use-archive-on-merge), wherever it merged.
    if (!result.ok) {
      toast.error(
        translate('auto.components.revioLayout.mergeFailed', 'Could not merge #{{value0}}', {
          value0: pr.number
        })
      )
    }
  } finally {
    merging.delete(pr.number)
    if (worktree) {
      void state.refreshGitHubForWorktree(worktree.id)
    }
  }
}

export function RevioMergeButton({ pr }: { pr: MergeablePr }): React.JSX.Element {
  const [busy, setBusy] = React.useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void mergeRevioPullRequest(pr).finally(() => setBusy(false))
      }}
      data-revio-pr-merge=""
      className="right-sidebar-header-no-drag ml-auto flex h-6 shrink-0 items-center gap-1.5 rounded-md bg-[var(--revio-pr-ready-strong)] px-2 text-[12.5px] font-medium text-[color:var(--revio-pr-ready-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {busy ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : (
        <GitMerge className="size-3.5" />
      )}
      {translate('auto.components.revioLayout.merge', 'Merge')}
    </button>
  )
}

/**
 * "Merge stack": merging the workspace's PR makes GitHub merge it and every PR below
 * it, bottom to top. Disabled, with GitHub's reason, while any of them could not merge.
 */
export function RevioMergeStackButton({
  pr,
  stack
}: {
  pr: MergeablePr
  stack: GitHubPRStack
}): React.JSX.Element {
  const confirm = useConfirmationDialog()
  const [busy, setBusy] = React.useState(false)
  const blocker = getGitHubPRStackMergeBlocker(getGitHubPRStackMergeScope(stack, pr.number))
  return (
    <button
      type="button"
      disabled={busy || blocker !== null}
      title={blocker ?? undefined}
      onClick={() => {
        setBusy(true)
        void confirm(
          buildGitHubPRStackMergeConfirmation({
            stack,
            currentPRNumber: pr.number,
            method: revioMergeMethod(pr.mergeMethodSettings),
            usesMergeQueue: pr.mergeQueueRequired === true
          })
        )
          .then((confirmed) => (confirmed ? mergeRevioPullRequest(pr) : undefined))
          .finally(() => setBusy(false))
      }}
      data-revio-pr-merge-stack=""
      className="right-sidebar-header-no-drag ml-auto flex h-6 shrink-0 items-center gap-1.5 rounded-md bg-[var(--revio-pr-ready-strong)] px-2 text-[12.5px] font-medium text-[color:var(--revio-pr-ready-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {busy ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : (
        <GitMerge className="size-3.5" />
      )}
      {translate('auto.components.revioLayout.mergeStack', 'Merge stack')}
    </button>
  )
}

/** The Automerge while checks are pending, or "Disable auto-merge" once it is on. */
export function RevioAutoMergeButton({
  pr,
  mode
}: {
  pr: MergeablePr
  mode: 'enable' | 'disable'
}): React.JSX.Element {
  const [busy, setBusy] = React.useState(false)
  const toggle = async (): Promise<void> => {
    const state = useAppStore.getState()
    const worktree = state.activeWorktreeId
      ? findWorktreeById(selectWorktreesByRepo(state), state.activeWorktreeId)
      : undefined
    const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
    if (!repo) {
      return
    }
    const enabled = mode === 'enable'
    const result = await setGitHubHostedReviewAutoMerge({
      repo,
      prNumber: pr.number,
      enabled,
      method: enabled ? revioMergeMethod(pr.mergeMethodSettings) : undefined
    })
    if (!result.ok) {
      toast.error(
        translate('auto.components.revioLayout.autoMergeFailed', "Couldn't update automerge")
      )
    }
    if (worktree) {
      void state.refreshGitHubForWorktree(worktree.id)
    }
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void toggle().finally(() => setBusy(false))
      }}
      data-revio-pr-action=""
      className="right-sidebar-header-no-drag ml-auto flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-border px-2 text-[12.5px] font-medium disabled:opacity-60"
    >
      {busy ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : (
        <GitMerge className="size-3.5" />
      )}
      {mode === 'enable'
        ? translate('auto.components.revioLayout.autoMerge', 'Automerge')
        : translate('auto.components.revioLayout.disableAutoMerge', 'Disable auto-merge')}
    </button>
  )
}
