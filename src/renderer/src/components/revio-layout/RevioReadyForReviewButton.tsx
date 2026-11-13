import React from 'react'
import { Eye, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { markGitHubHostedReviewReadyForReview } from '@/components/right-sidebar/hosted-review/provider-actions/hosted-review-github-actions'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'

/** "Ready for review" on a draft PR: GitHub marks it ready, then the bar refreshes. */
export function RevioReadyForReviewButton({ prNumber }: { prNumber: number }): React.JSX.Element {
  const [busy, setBusy] = React.useState(false)
  const markReady = async (): Promise<void> => {
    const state = useAppStore.getState()
    const worktree = state.activeWorktreeId
      ? findWorktreeById(selectWorktreesByRepo(state), state.activeWorktreeId)
      : undefined
    const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
    if (!repo || !worktree) {
      return
    }
    const result = await markGitHubHostedReviewReadyForReview({ repo, prNumber })
    if (!result.ok) {
      toast.error(
        translate(
          'auto.components.revioLayout.readyForReviewFailed',
          'Could not mark #{{value0}} ready for review',
          { value0: prNumber }
        )
      )
    }
    void state.refreshGitHubForWorktree(worktree.id)
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void markReady().finally(() => setBusy(false))
      }}
      data-revio-pr-action=""
      className="right-sidebar-header-no-drag ml-auto flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-border px-2 text-[12.5px] font-medium disabled:opacity-60"
    >
      {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
      {translate('auto.components.revioLayout.readyForReview', 'Ready for review')}
    </button>
  )
}
