import { basename } from '@/lib/path'
import { getWorktreeCardTitleDisplay } from '@/components/sidebar/workspace-card/identity/worktree-card-title-display'
import type { Worktree } from '../../../../shared/worktree/types'

/**
 * The workspace's name in the title row. On this Mac a workspace's folder is named after it; a
 * cloud workspace's checkout is the repository's folder in its sandbox (`/vercel/<repo>`), which
 * read "example-repo › example-repo", so it shows the name its sidebar row shows: the stored
 * name, or the PR's title while that name is only the branch.
 */
export function revioWorkspaceLabel(
  worktree: Pick<Worktree, 'path' | 'displayName' | 'branch'>,
  cloud: boolean,
  reviewTitle?: string | null
): string {
  if (cloud) {
    const branch = worktree.branch.replace(/^refs\/heads\//, '')
    return (
      getWorktreeCardTitleDisplay({
        storedDisplayName: worktree.displayName,
        branchName: branch,
        reviewTitle
      }).trim() ||
      branch ||
      basename(worktree.path)
    )
  }
  return basename(worktree.path) || worktree.displayName.trim()
}
