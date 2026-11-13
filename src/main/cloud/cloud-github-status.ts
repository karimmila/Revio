import type {
  CloudGithubRepoCoverage,
  CloudGithubSignIn,
  CloudGithubStatus
} from '../../shared/cloud/cloud-types'
import { githubAppInstallUrl, githubAuthorizationsUrl } from '../../shared/cloud/github-app-config'
import type { Repo } from '../../shared/repo-types'
import { githubRepoOf, type GithubRepo } from './cloud-github'
import { githubCoverage } from './cloud-github-access'
import { githubMigrationNoticePending } from './cloud-github-pat-migration'
import { githubAppGetter } from './github-app-api'
import { githubOwnerId, isRepoCovered, type GithubCoverage } from './github-app-coverage'
import { currentGithubAppConfig } from './github-app-settings'
import { githubAccount, githubSignInExpired } from './github-app-session'

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/

export function isGithubOwner(owner: string): boolean {
  return OWNER_PATTERN.test(owner)
}

export async function orcaGithubRepos(
  getRepos: () => Repo[]
): Promise<(GithubRepo & { repoId: string })[]> {
  const repos: (GithubRepo & { repoId: string })[] = []
  for (const repo of getRepos()) {
    if (repo.kind === 'folder') {
      continue
    }
    const github = await githubRepoOf(repo.path)
    if (github && isGithubOwner(github.owner)) {
      repos.push({ ...github, repoId: repo.id })
    }
  }
  return repos
}

// Owner ids never change; looked up once per run for the install page's target.
const ownerIds = new Map<string, number | null>()

async function ownerIdOf(owner: string, coverage: GithubCoverage | null): Promise<number | null> {
  const key = owner.toLowerCase()
  const installed = coverage?.installedOwners.get(key)
  if (installed) {
    return installed
  }
  if (!ownerIds.has(key)) {
    ownerIds.set(key, await githubOwnerId(githubAppGetter(), owner))
  }
  return ownerIds.get(key) ?? null
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function readGithubStatus(
  getRepos: () => Repo[],
  live: { signIn: CloudGithubSignIn | null; pendingInstallOwner: string | null }
): Promise<CloudGithubStatus> {
  const config = currentGithubAppConfig()
  const account = githubAccount()
  const repos = await orcaGithubRepos(getRepos)
  let coverage: GithubCoverage | null = null
  let coverageError: string | null = null
  if (config.configured && account) {
    coverage = await githubCoverage().catch((error: unknown) => {
      coverageError = errorText(error)
      return null
    })
  }
  const rows: CloudGithubRepoCoverage[] = []
  for (const repo of repos) {
    const covered = coverage ? isRepoCovered(coverage, repo) : null
    rows.push({
      repoId: repo.repoId,
      owner: repo.owner,
      name: repo.name,
      state: covered === null ? 'unknown' : covered ? 'covered' : 'not-covered',
      installUrl:
        config.configured && covered !== true
          ? githubAppInstallUrl(config, account ? await ownerIdOf(repo.owner, coverage) : null)
          : null
    })
  }
  return {
    app: config.configured
      ? {
          configured: true,
          host: config.host,
          slug: config.slug,
          custom: config.custom,
          authorizationsUrl: githubAuthorizationsUrl(config)
        }
      : { configured: false, message: config.message },
    account: account ? { login: account.login } : null,
    signInExpired: githubSignInExpired(),
    signIn: live.signIn,
    repos: rows,
    pendingInstallOwner: live.pendingInstallOwner,
    coverageError,
    migrated: githubMigrationNoticePending()
  }
}
