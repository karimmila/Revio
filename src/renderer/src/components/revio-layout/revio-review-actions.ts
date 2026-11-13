import { useAppStore } from '@/store'
import { getGitHubActionTarget } from '@/components/right-sidebar/hosted-review/provider-actions/hosted-review-github-actions'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import type { Repo } from '../../../../shared/repo-types'
import type { GitHubAssignableUser } from '../../../../shared/github/pull-request-types'

/** The active workspace's repository, when its GitHub actions run on this Mac. */
export function activeLocalGitHubRepo(): Repo | null {
  const state = useAppStore.getState()
  const worktree = state.activeWorktreeId
    ? findWorktreeById(selectWorktreesByRepo(state), state.activeWorktreeId)
    : undefined
  const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
  return repo && getGitHubActionTarget(repo).kind !== 'environment' ? repo : null
}

/** People who can review: the repository's assignable users minus the PR's author and those picked. */
export function reviewerCandidates(
  users: readonly GitHubAssignableUser[],
  query: string,
  exclude: readonly string[]
): GitHubAssignableUser[] {
  const skip = new Set(exclude.map((login) => login.toLowerCase()))
  const needle = query.trim().toLowerCase()
  return users.filter(
    (user) =>
      !skip.has(user.login.toLowerCase()) &&
      (!needle ||
        user.login.toLowerCase().includes(needle) ||
        (user.name ?? '').toLowerCase().includes(needle))
  )
}
