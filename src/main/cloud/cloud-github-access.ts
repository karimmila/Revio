import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'
import type { GithubRepo } from './cloud-github'
import { githubAppGetter } from './github-app-api'
import { isRepoCovered, readGithubCoverage, type GithubCoverage } from './github-app-coverage'
import {
  githubAccessToken,
  GithubSignInRequired,
  onGithubSessionChange,
  readGithubSessionSecrets
} from './github-app-session'

/**
 * What cloud work needs from GitHub: the signed-in person's app token, and proof that the app is
 * installed on the repository. Coverage is cached briefly; a miss is checked again before a
 * workspace is refused, since the person may have just installed the app.
 */
const COVERAGE_TTL_MS = 2 * 60_000

type Fetch = typeof fetch

let cached: GithubCoverage | null = null
let reading: Promise<GithubCoverage> | null = null

onGithubSessionChange((event) => {
  if (event !== 'rotated') {
    cached = null
  }
})

export function forgetGithubCoverage(): void {
  cached = null
}

export async function githubCoverage(
  options: { force?: boolean; fetchImpl?: Fetch; now?: () => number } = {}
): Promise<GithubCoverage> {
  const now = options.now ?? Date.now
  if (!options.force && cached && now() - cached.checkedAt < COVERAGE_TTL_MS) {
    return cached
  }
  reading ??= readGithubCoverage(githubAppGetter(options.fetchImpl), now())
    .then((coverage) => {
      cached = coverage
      return coverage
    })
    .finally(() => {
      reading = null
    })
  return reading
}

export function installAppMessage(repo: GithubRepo): string {
  return `Install the ${FORK_PRODUCT_NAME} GitHub App on ${repo.owner} and give it ${repo.name}, in Settings > Account.`
}

/** Why cloud work cannot reach a repository now, as the person should read it; null when it can. */
export async function githubCoverageProblem(
  repo: GithubRepo,
  options: { force?: boolean; fetchImpl?: Fetch } = {}
): Promise<string | null> {
  try {
    await githubAccessToken({ fetchImpl: options.fetchImpl })
    const coverage = await githubCoverage(options)
    return isRepoCovered(coverage, repo) ? null : installAppMessage(repo)
  } catch (error) {
    if (error instanceof GithubSignInRequired) {
      return error.message
    }
    return error instanceof Error ? error.message : String(error)
  }
}

/**
 * The fresh app token for the sandbox broker. A repository the cached coverage misses is checked
 * with GitHub once more before the person is told to install the app.
 */
export async function githubTokenForRepo(
  repo: GithubRepo,
  fetchImpl: Fetch = fetch
): Promise<string> {
  const token = await githubAccessToken({ fetchImpl })
  if (isRepoCovered(await githubCoverage({ fetchImpl }), repo)) {
    return token
  }
  if (isRepoCovered(await githubCoverage({ fetchImpl, force: true }), repo)) {
    return githubAccessToken({ fetchImpl })
  }
  throw new Error(installAppMessage(repo))
}

/** Every GitHub secret this Mac keeps: none may ever reach a sandbox's environment. */
export function readAllGithubTokens(): string[] {
  return readGithubSessionSecrets()
}
