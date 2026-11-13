import { ghRateLimitScopeKey } from '../../git/gh-rate-limit-breaker'
import { getGithubAppAuthProvider } from '../../git/command-runner/github-app-auth'

// Use the GitHub App sign-in's token to avoid the shared per-IP quota; signed out, requests go
// unauthenticated. Never `gh auth token`: that reads the keychain.

const TOKEN_TTL_MS = 5 * 60_000

export type ReleaseApiToken = { token: string; rateLimitScope: string }
type TokenCacheEntry = { token: ReleaseApiToken | null; expiresAt: number }

let cached: TokenCacheEntry | null = null
let inFlight: Promise<ReleaseApiToken | null> | null = null
let generation = 0

async function readGhToken(): Promise<ReleaseApiToken | null> {
  const provider = getGithubAppAuthProvider()
  if (!provider || provider.host() !== 'github.com') {
    return null
  }
  const token = await provider.token().catch(() => null)
  return token ? { token, rateLimitScope: ghRateLimitScopeKey('native', 'github.com') } : null
}

export async function resolveReleaseApiToken(
  now: number = Date.now()
): Promise<ReleaseApiToken | null> {
  if (cached && cached.expiresAt > now) {
    return cached.token
  }
  if (inFlight) {
    return inFlight
  }
  const readGeneration = generation
  inFlight = readGhToken()
    .then((token) => {
      // A rejection during this read must not resurrect the refused keyring token.
      if (generation !== readGeneration) {
        return null
      }
      cached = { token, expiresAt: now + TOKEN_TTL_MS }
      return token
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/** Cache rejection for a TTL rather than re-reading a stale keyring token on every load. */
export function rejectReleaseApiToken(now: number = Date.now()): void {
  generation += 1
  cached = { token: null, expiresAt: now + TOKEN_TTL_MS }
}

/** @internal — test-only */
export function _resetReleaseApiTokenCache(): void {
  generation += 1
  cached = null
  inFlight = null
}
