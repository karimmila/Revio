import type { GithubRepoSummary } from '../../shared/github-repo-list'
import type { GithubCoverage } from '../cloud/github-app-coverage'

/**
 * The repositories the GitHub App reaches for the signed-in person, as Clone's "Your GitHub
 * repositories" rows. They need no `gh` on this Mac, and they are the ones pull requests and
 * cloud workspaces work in.
 */
export function githubAppRepoSummaries(
  coverage: Pick<GithubCoverage, 'listed'>,
  host: string
): GithubRepoSummary[] {
  return (coverage.listed ?? []).map((repo) => ({
    nameWithOwner: `${repo.owner}/${repo.name}`,
    url: `https://${host}/${repo.owner}/${repo.name}`,
    isPrivate: repo.isPrivate
  }))
}

/** The app's repositories first: they work without `gh`, which a new Mac often lacks. */
export async function appReposElseGh(
  app: () => Promise<GithubRepoSummary[]>,
  gh: () => Promise<GithubRepoSummary[]>
): Promise<GithubRepoSummary[]> {
  const fromApp = await app().catch(() => [])
  return fromApp.length > 0 ? fromApp : gh().catch(() => [])
}
