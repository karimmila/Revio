import {
  GithubAppSignInRequiredError,
  setGithubAppAuthProvider,
  type GithubAppAuthProvider
} from '../git/command-runner/github-app-auth'
import { githubCoverage } from './cloud-github-access'
import { isRepoCovered } from './github-app-coverage'
import { currentGithubAppConfig } from './github-app-settings'
import {
  githubAccessToken,
  githubAccount,
  githubPeekAccessToken,
  GithubSignInRequired
} from './github-app-session'

/**
 * The one token source for Mac-side GitHub work (gh, git over HTTPS): the Revio GitHub App user
 * token. The session is unsealed once and kept in memory (github-app-session-store), refreshes are
 * single-flight in githubAccessToken, and coverage reuses the cloud's cached installation list.
 */
export function createGithubAppAuthProvider(): GithubAppAuthProvider {
  return {
    host: () => {
      const config = currentGithubAppConfig()
      return config.configured ? config.host.toLowerCase() : null
    },
    token: async () => {
      try {
        return await githubAccessToken()
      } catch (error) {
        if (error instanceof GithubSignInRequired) {
          throw new GithubAppSignInRequiredError(error.message)
        }
        throw error
      }
    },
    login: () => githubAccount()?.login ?? null,
    peekToken: () => githubPeekAccessToken(),
    coverage: async (owner, name) => {
      try {
        return isRepoCovered(await githubCoverage(), { owner, name }) ? 'covered' : 'not-covered'
      } catch {
        // GitHub could not list the installations: let the call run and fail on its own terms.
        return 'unknown'
      }
    }
  }
}

export function registerGithubAppAuthProvider(): void {
  setGithubAppAuthProvider(createGithubAppAuthProvider())
}
