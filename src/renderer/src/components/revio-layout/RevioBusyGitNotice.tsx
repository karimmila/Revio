import type React from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { GitConflictOperation } from '../../../../shared/git/status/git-status-types'

/** The notice's title for a rebase, merge or cherry-pick in progress; null when git is idle. */
export function busyGitTitle(operation: GitConflictOperation | undefined): string | null {
  if (operation === 'rebase') {
    return translate('auto.components.revioLayout.busyRebase', 'Rebase in progress')
  }
  if (operation === 'merge') {
    return translate('auto.components.revioLayout.busyMerge', 'Merge in progress')
  }
  return operation === 'cherry-pick'
    ? translate('auto.components.revioLayout.busyCherryPick', 'Cherry-pick in progress')
    : null
}

/**
 * The busy-git guard in the Changes tab. Orca's source-control header shows the operation,
 * but the workspace layout hides that header, so the notice sits above the file list instead.
 */
export function RevioBusyGitNotice({
  worktreeId
}: {
  worktreeId: string | null | undefined
}): React.JSX.Element | null {
  const operation = useAppStore((s) =>
    worktreeId ? s.gitConflictOperationByWorktree[worktreeId] : undefined
  )
  const title = busyGitTitle(operation)
  if (!title) {
    return null
  }
  return (
    <div
      role="status"
      data-revio-busy-git=""
      className="mx-3 my-1.5 shrink-0 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[12px]"
    >
      <div className="font-medium text-foreground">{title}</div>
      <div className="text-muted-foreground">
        {translate(
          'auto.components.revioLayout.busyGitHint',
          'Finish rebasing or merging to see changes'
        )}
      </div>
    </div>
  )
}
