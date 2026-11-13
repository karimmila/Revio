import type { AppState } from '@/store/types'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'

export type WorktreeListing = { ids: Set<string>; repoIds: Set<string> }

export function worktreeListingOf(state: AppState): WorktreeListing {
  const byRepo = selectWorktreesByRepo(state) ?? {}
  return {
    ids: new Set(
      Object.values(byRepo).flatMap((worktrees) => (worktrees ?? []).map((worktree) => worktree.id))
    ),
    repoIds: new Set(Object.keys(byRepo).filter((repoId) => byRepo[repoId] !== undefined))
  }
}

/**
 * Workspaces that were listed and no longer are, in a repository that is still listed. A list
 * still loading, or a repository dropped and re-read, removes nothing.
 */
export function removedWorktreeIds(previous: WorktreeListing, next: WorktreeListing): Set<string> {
  return new Set(
    [...previous.ids].filter((id) => !next.ids.has(id) && next.repoIds.has(id.split('::')[0] ?? ''))
  )
}
