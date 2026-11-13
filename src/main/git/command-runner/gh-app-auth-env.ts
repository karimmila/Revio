import { ghArgsRepository } from './gh-args-repository'
import { hasSandboxGithubPlaceholder } from '../../../shared/cloud/cloud-github-placeholder'
import {
  getGithubAppAuthProvider,
  githubAppGhEnv,
  GithubAppNotInstalledError,
  GithubAppSignInRequiredError
} from './github-app-auth'

export class GhAuthCommandRefusedError extends Error {
  constructor() {
    super('gh auth commands read the keychain; Revio uses its GitHub App sign-in instead.')
    this.name = 'GhAuthCommandRefusedError'
  }
}

/**
 * The env for one gh child: the app token for the call's host, or a throw before anything spawns.
 * The host and sign-in are checked first, then coverage, so an uncovered repository costs no
 * GitHub request beyond the shared, cached coverage read.
 */
export async function resolveGhAppAuthEnv(
  args: readonly string[],
  targetHost: string,
  baseEnv: NodeJS.ProcessEnv | undefined,
  options: { wsl?: boolean } = {}
): Promise<NodeJS.ProcessEnv> {
  if (args[0] === 'auth') {
    throw new GhAuthCommandRefusedError()
  }
  const provider = getGithubAppAuthProvider()
  const appHost = provider?.host()
  if (!provider || !appHost) {
    const ambient = baseEnv ?? process.env
    // A cloud sandbox's own server: no sign-in lives here, and none may. Its gh carries the
    // placeholder and the sandbox firewall adds the real token to REST calls for its repository.
    if (!provider && hasSandboxGithubPlaceholder(ambient)) {
      return { ...ambient, GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1' }
    }
    throw new GithubAppSignInRequiredError()
  }
  const host = targetHost.toLowerCase()
  if (host !== appHost) {
    throw new GithubAppSignInRequiredError(
      `Revio's GitHub sign-in covers ${appHost}; ${host} is not supported.`
    )
  }
  // The provider throws GithubAppSignInRequiredError when signed out; a refresh that could not
  // reach GitHub propagates as-is so it reads as a network failure, not a sign-out.
  const token = await provider.token()
  const repo = ghArgsRepository(args)
  if (repo && (repo.host === null || repo.host === appHost)) {
    if ((await provider.coverage(repo.owner, repo.name)) === 'not-covered') {
      throw new GithubAppNotInstalledError(repo.owner)
    }
  }
  return githubAppGhEnv(baseEnv ?? process.env, appHost, token, options)
}
