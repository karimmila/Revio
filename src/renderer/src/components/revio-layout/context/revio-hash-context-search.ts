import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { lookupGitHubWorkItemDetailsForSource } from '@/lib/work-items/github/github-work-item-source-lookup'
import type {
  GitHubWorkItem,
  GitHubWorkItemDetails
} from '../../../../../shared/github/work-item-types'

const LIMIT = 20

function activeRepo(): { id: string; path: string } | null {
  const state = useAppStore.getState()
  const worktree = state.activeWorktreeId
    ? findWorktreeById(selectWorktreesByRepo(state), state.activeWorktreeId)
    : null
  return (worktree && state.repos.find((entry) => entry.id === worktree.repoId)) ?? null
}

/** Open PRs and issues of the repository behind the workspace on screen. */
export async function searchWorkItems(query: string): Promise<readonly GitHubWorkItem[]> {
  const repo = activeRepo()
  if (!repo) {
    return []
  }
  const state = useAppStore.getState()
  return (await state.fetchWorkItems(repo.id, repo.path, LIMIT, `is:open ${query}`.trim())) ?? []
}

/** The picked PR's or issue's description and, for a PR, its changed files. */
export async function readWorkItemDetails(
  item: Pick<GitHubWorkItem, 'type' | 'number'>
): Promise<GitHubWorkItemDetails | null> {
  const repo = activeRepo()
  if (!repo) {
    return null
  }
  return lookupGitHubWorkItemDetailsForSource({
    repoPath: repo.path,
    repoId: repo.id,
    number: item.number,
    type: item.type
  })
}
