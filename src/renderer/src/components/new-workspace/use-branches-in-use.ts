import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { branchName } from '@/lib/git-utils'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'

const NONE: ReadonlySet<string> = new Set()

/** The branches a workspace of this repo has checked out: git refuses a second worktree on one. */
export function useBranchesInUse(repoId: string | null): ReadonlySet<string> {
  const worktrees = useAppStore((s) => (repoId ? selectWorktreesByRepo(s)[repoId] : undefined))
  return useMemo(
    () =>
      worktrees
        ? new Set(
            worktrees.flatMap((worktree) => (worktree.branch ? [branchName(worktree.branch)] : []))
          )
        : NONE,
    [worktrees]
  )
}
