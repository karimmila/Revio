import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'
import { currentGithubAppConfig } from './github-app-settings'
import { githubAccessToken, GithubSignInRequired } from './github-app-session'

type Fetch = typeof fetch

export type GithubGet = (path: string) => Promise<Response>

/**
 * A GET on the GitHub API as the signed-in person. A 401 forces one refresh (GitHub may have
 * rotated or revoked the token early) and one retry; a second 401 is the caller's to report.
 */
export function githubAppGetter(fetchImpl: Fetch = fetch): GithubGet {
  return async (path) => {
    const config = currentGithubAppConfig()
    if (!config.configured) {
      throw new GithubSignInRequired(config.message)
    }
    const send = (token: string): Promise<Response> =>
      fetchImpl(`${config.apiBase}${path}`, {
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
          'user-agent': FORK_PRODUCT_NAME
        },
        signal: AbortSignal.timeout(15_000)
      })
    const token = await githubAccessToken({ fetchImpl })
    const response = await send(token)
    if (response.status !== 401) {
      return response
    }
    return send(await githubAccessToken({ fetchImpl, staleToken: token }))
  }
}
