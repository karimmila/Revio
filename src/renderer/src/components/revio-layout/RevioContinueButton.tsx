import React from 'react'
import { GitBranchPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'

/**
 * "Continue" in the merged PR bar: this workspace moves to a new branch off the freshly
 * fetched target, so the same chats keep going on fresh work.
 */
export async function continueOnNewBranch(worktreeId: string): Promise<boolean> {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  const baseRef = state.gitBranchCompareSummaryByWorktree?.[worktreeId]?.baseRef
  const run = window.api.git.continueOnNewBranch
  if (!worktree || !baseRef || !run) {
    toast.error(
      translate(
        'auto.components.revioLayout.continueUnavailable',
        'Could not find the target branch to continue from.'
      )
    )
    return false
  }
  try {
    const result = await run({ worktreePath: worktree.path, baseRef })
    toast.success(
      translate('auto.components.revioLayout.continued', 'Switched to {{value0}} off {{value1}}', {
        value0: result.branch,
        value1: result.base
      })
    )
    return true
  } catch (error) {
    toast.error(translate('auto.components.revioLayout.continueFailed', 'Could not continue'), {
      description: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}

export function RevioContinueButton({ worktreeId }: { worktreeId: string }): React.JSX.Element {
  const [busy, setBusy] = React.useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      title={translate(
        'auto.components.revioLayout.continueTitle',
        'Continue on a new branch with the same chats'
      )}
      onClick={() => {
        setBusy(true)
        void continueOnNewBranch(worktreeId).finally(() => setBusy(false))
      }}
      className="right-sidebar-header-no-drag ml-auto flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-[var(--revio-pr-merged-text)] transition-colors hover:bg-foreground/5 disabled:opacity-50"
    >
      <GitBranchPlus className="size-3.5" />
      {translate('auto.components.revioLayout.continue', 'Continue')}
    </button>
  )
}
