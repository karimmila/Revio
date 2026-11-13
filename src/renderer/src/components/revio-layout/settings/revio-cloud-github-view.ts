import type {
  CloudGithubRepoCoverage,
  CloudGithubStatus
} from '../../../../../shared/cloud/cloud-types'

/**
 * GitHub serves every account's avatar at `<host>/<login>.png`, GitHub Enterprise Server too, so
 * the renderer needs no extra field or API call to show it.
 */
export function githubAvatarUrl(host: string, login: string): string {
  return `https://${host}/${encodeURIComponent(login)}.png?size=64`
}

export type GithubRepoRow = CloudGithubRepoCoverage & { offerInstall: boolean }

/**
 * One Install button per owner, on its first uncovered repository, since one install serves every
 * repository GitHub lets it reach. Owners compare case-insensitively, like GitHub does.
 */
export function githubRepoRows(repos: CloudGithubRepoCoverage[]): GithubRepoRow[] {
  const offered = new Set<string>()
  return repos.map((repo) => {
    const ownerKey = repo.owner.toLowerCase()
    const offerInstall = repo.state !== 'covered' && !!repo.installUrl && !offered.has(ownerKey)
    if (offerInstall) {
      offered.add(ownerKey)
    }
    return { ...repo, offerInstall }
  })
}

export function allGithubReposCovered(status: CloudGithubStatus): boolean {
  return status.repos.length > 0 && status.repos.every((repo) => repo.state === 'covered')
}
