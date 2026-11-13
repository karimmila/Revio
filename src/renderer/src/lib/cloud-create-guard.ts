import { parseGithubRemote, type GithubRepoRef } from '../../../shared/cloud/github-remote'
import type { CloudReadinessAction, CloudRepoReadiness } from '../../../shared/cloud/cloud-types'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
import { isGitRepoKind } from '../../../shared/repo-kind'
import type { Repo } from '../../../shared/repo-types'

type RepoFacts = Pick<
  Repo,
  'id' | 'displayName' | 'kind' | 'gitRemoteIdentity' | 'connectionId' | 'executionHostId'
>

export function githubSlugOfRepo(repo: Pick<Repo, 'gitRemoteIdentity'>): GithubRepoRef | null {
  const url = repo.gitRemoteIdentity?.remoteUrl
  return url ? parseGithubRemote(url) : null
}

/**
 * A cloud workspace is made from a Git repository on this Mac whose origin is on GitHub (the
 * sandbox clones it from there). Folder projects such as "~" never qualify.
 */
export function isCloudCapableRepo(repo: RepoFacts): boolean {
  return (
    isGitRepoKind(repo) &&
    getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID &&
    githubSlugOfRepo(repo) !== null
  )
}

/** The Cloud project picker: cloud-capable repositories, the last used first, then the readiest. */
export function orderCloudRepos<T extends RepoFacts>(
  repos: readonly T[],
  readiness: ReadonlyMap<string, CloudRepoReadiness>,
  lastUsedRepoId: string | null
): T[] {
  const rank = (repo: T): number => {
    if (repo.id === lastUsedRepoId) {
      return 0
    }
    const entry = readiness.get(repo.id)
    // Closest to ready next: only a build missing beats a missing GitHub token or Vercel.
    return !entry ? 3 : !entry.blocked ? 1 : entry.blocked.action === 'build' ? 2 : 3
  }
  return repos
    .filter(isCloudCapableRepo)
    .map((repo, index) => ({ repo, index }))
    .sort((a, b) => rank(a.repo) - rank(b.repo) || a.index - b.index)
    .map(({ repo }) => repo)
}

export type CloudCreateBlock = {
  reason: string
  /** The one step that fixes it; null when the fix is to pick another repository or wait. */
  action: CloudReadinessAction | null
  repoId: string | null
}

/**
 * Why Create in the Cloud location must not go ahead with this repository, or null when it may.
 * There is no fallback to a Mac workspace: a blocked create says why and what fixes it.
 */
export function cloudCreateBlock(
  repo: RepoFacts | null | undefined,
  readiness: ReadonlyMap<string, CloudRepoReadiness> | null
): CloudCreateBlock | null {
  if (!repo) {
    return {
      reason: 'Pick a GitHub repository to create a cloud workspace from.',
      action: null,
      repoId: null
    }
  }
  const slug = githubSlugOfRepo(repo)
  if (!slug || !isCloudCapableRepo(repo)) {
    return {
      reason: `${repo.displayName} can't run in the cloud: only Git repositories whose origin is on GitHub can. Pick one of those.`,
      action: null,
      repoId: repo.id
    }
  }
  const entry = readiness?.get(repo.id)
  if (!entry) {
    return {
      reason: `Checking whether ${slug.owner}/${slug.name} is ready for the cloud…`,
      action: null,
      repoId: repo.id
    }
  }
  return entry.blocked ? { ...entry.blocked, repoId: repo.id } : null
}
