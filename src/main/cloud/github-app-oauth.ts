import { z } from 'zod'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

/**
 * GitHub's OAuth endpoints for a GitHub App's user access tokens. Device-flow tokens are created
 * and refreshed with the client id alone: GitHub requires `client_secret` "unless the user access
 * token was generated using the device flow", so no secret ships with the app.
 */
export type GithubTokenSet = {
  accessToken: string
  /** Null when the app has token expiration turned off. */
  refreshToken: string | null
  accessExpiresAt: number | null
  refreshExpiresAt: number | null
}

export type OAuthAnswer =
  | { ok: true; tokens: GithubTokenSet }
  | { ok: false; error: string; interval?: number }

type Fetch = typeof fetch

const TokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive().optional(),
  refresh_token_expires_in: z.number().positive().optional()
})
const ErrorSchema = z.object({ error: z.string(), interval: z.number().positive().optional() })

/** GitHub answers OAuth errors with 200 and an `error` field; anything else unreadable is ours. */
export function readOAuthAnswer(body: unknown, now: number): OAuthAnswer {
  const tokens = TokenSchema.safeParse(body)
  if (tokens.success) {
    const data = tokens.data
    return {
      ok: true,
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        accessExpiresAt: data.expires_in ? now + data.expires_in * 1000 : null,
        refreshExpiresAt: data.refresh_token_expires_in
          ? now + data.refresh_token_expires_in * 1000
          : null
      }
    }
  }
  const error = ErrorSchema.safeParse(body)
  return error.success
    ? { ok: false, error: error.data.error, interval: error.data.interval }
    : { ok: false, error: 'unreadable_response' }
}

export const GITHUB_SIGN_IN_OFFLINE =
  'Could not reach GitHub. Check your internet connection and try again.'

/**
 * GitHub did not answer the question: no network, a timeout, a rate limit or a server error. The
 * request can be sent again; `retryAfterMs` is GitHub's own wait when it gave one.
 */
export class GithubOAuthUnavailable extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number | null = null
  ) {
    super(message)
  }
}

export async function postOAuthForm(
  webBase: string,
  path: '/login/device/code' | '/login/oauth/access_token',
  params: Record<string, string>,
  fetchImpl: Fetch
): Promise<unknown> {
  let response: Response
  try {
    response = await fetchImpl(`${webBase}${path}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': FORK_PRODUCT_NAME
      },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(20_000)
    })
  } catch {
    // "fetch failed" and "The operation was aborted" say nothing a person can act on.
    throw new GithubOAuthUnavailable(GITHUB_SIGN_IN_OFFLINE)
  }
  if (!response.ok && response.status !== 400 && response.status !== 401) {
    const retryAfter = Number(response.headers.get('retry-after'))
    throw new GithubOAuthUnavailable(
      response.status === 429 || response.status === 403
        ? 'GitHub is limiting sign-in requests right now. Wait a minute and try again.'
        : `GitHub is having trouble right now (status ${response.status}). Try again in a moment.`,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null
    )
  }
  return response.json().catch(() => ({}))
}

/** Trades a refresh token for a new pair; GitHub rotates both and the old refresh token dies. */
export async function refreshGithubTokens(
  webBase: string,
  clientId: string,
  refreshToken: string,
  fetchImpl: Fetch,
  now: () => number = Date.now
): Promise<OAuthAnswer> {
  const body = await postOAuthForm(
    webBase,
    '/login/oauth/access_token',
    { client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken },
    fetchImpl
  )
  return readOAuthAnswer(body, now())
}
