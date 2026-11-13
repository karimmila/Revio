import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GithubAppConfig } from '../../shared/cloud/github-app-config'
import { cloudDataRoot } from './cloud-repo-store'
import { currentGithubAppConfig } from './github-app-settings'
import { refreshGithubTokens, type GithubTokenSet } from './github-app-oauth'
import {
  readStoredSession,
  removeStoredSession,
  sessionKeychainRefused,
  writeStoredSession,
  type Session
} from './github-app-session-store'

/**
 * One GitHub identity per Mac profile: the GitHub App user token pair, sealed with the keychain.
 * Access tokens live 8 hours and refresh tokens 6 months; every refresh rotates both, so the
 * stored pair is rewritten each time and a refresh must never run twice at once.
 */
/** Refresh this long before the access token runs out, so a request never carries a dying one. */
export const REFRESH_MARGIN_MS = 10 * 60_000

/**
 * Dev builds only: ORCA_DEV_GITHUB_REFRESH_MARGIN_MS widens the margin so a live check can force a
 * token rotation now instead of waiting hours for one. Packaged builds always use the default.
 */
export function refreshMarginMs(env: NodeJS.ProcessEnv = process.env): number {
  const override = Number(env.ORCA_DEV_GITHUB_REFRESH_MARGIN_MS)
  return env.NODE_ENV === 'development' && Number.isFinite(override) && override > 0
    ? override
    : REFRESH_MARGIN_MS
}

export type GithubAccount = { login: string; userId: number }
/** `expired`: GitHub refused the refresh, or the refresh token itself ran out. */
export type GithubSessionEvent = 'signed-in' | 'rotated' | 'signed-out' | 'expired'

export const SIGN_IN_AGAIN = 'Your GitHub sign-in expired. Sign in again in Settings > Account.'
export const NOT_SIGNED_IN = 'Sign in with GitHub in Settings > Account to use cloud workspaces.'

export const KEYCHAIN_REFUSED =
  'The keychain did not unlock your GitHub sign-in. Unlock it, then choose Check again in Settings > Account.'

export class GithubSignInRequired extends Error {}

export {
  onSessionKeychainRefused,
  retrySessionUnseal,
  sessionKeychainRefused
} from './github-app-session-store'

type Fetch = typeof fetch
type ConfiguredApp = Extract<GithubAppConfig, { configured: true }>

/**
 * A network failure is retried before the sign-in is given up: GitHub kills the refresh token only
 * when it answers, so a refresh that never arrived can be sent again.
 */
export const REFRESH_RETRY_DELAYS_MS = [1_000, 5_000, 15_000]

/**
 * After a refresh that never reached GitHub, wait this long before the next try. Every gh call
 * asks for a token, so without it an offline Mac would run the whole retry ladder on each call.
 */
export const REFRESH_UNREACHABLE_COOLDOWN_MS = 60_000

export const GITHUB_UNREACHABLE =
  'GitHub could not be reached to refresh the sign-in. Check your internet connection; this is tried again by itself.'

let refreshing: Promise<string> | null = null
let refreshUnreachableUntil = 0
const listeners = new Set<(event: GithubSessionEvent) => void>()

export function onGithubSessionChange(listener: (event: GithubSessionEvent) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit(event: GithubSessionEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // A listener's failure must not undo a sign-in or a rotation.
    }
  }
}

/** Survives a restart, so Settings keeps saying "expired" until the person signs in again. */
function expiredMarkerFile(): string {
  return join(cloudDataRoot(), 'github-app-expired')
}

function clearExpiredMarker(): void {
  rmSync(expiredMarkerFile(), { force: true })
}

/** The session for the app in use now; a session from another app or host does not count. */
function readSession(config: GithubAppConfig = currentGithubAppConfig()): Session | null {
  const session = readStoredSession()
  if (!session || !config.configured) {
    return null
  }
  return session.clientId === config.clientId && session.host === config.host ? session : null
}

function writeSession(session: Session): void {
  writeStoredSession(session)
}

export function githubAccount(): GithubAccount | null {
  const session = readSession()
  return session ? { login: session.login, userId: session.userId } : null
}

/** True after the sign-in expired and until the next sign-in: the UI says "Sign in again". */
export function githubSignInExpired(): boolean {
  return existsSync(expiredMarkerFile()) && !readSession()
}

export function saveGithubSession(
  config: ConfiguredApp,
  tokens: GithubTokenSet,
  account: GithubAccount
): void {
  writeSession({ clientId: config.clientId, host: config.host, ...tokens, ...account })
  clearExpiredMarker()
  refreshUnreachableUntil = 0
  emit('signed-in')
}

/** Forgets the tokens on this Mac. GitHub keeps the authorization until the person revokes it. */
export function signOutGithub(): void {
  removeStoredSession()
  clearExpiredMarker()
  refreshUnreachableUntil = 0
  emit('signed-out')
}

function expire(): never {
  removeStoredSession()
  mkdirSync(cloudDataRoot(), { recursive: true, mode: 0o700 })
  writeFileSync(expiredMarkerFile(), '', { mode: 0o600 })
  emit('expired')
  throw new GithubSignInRequired(SIGN_IN_AGAIN)
}

type Sleep = (ms: number) => Promise<void>

const sleepFor: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Thrown when GitHub could not be reached; the stored tokens are still good to try again. */
export class GithubUnreachable extends Error {}

async function requestRefresh(
  config: ConfiguredApp,
  refreshToken: string,
  fetchImpl: Fetch,
  now: () => number,
  sleep: Sleep
): ReturnType<typeof refreshGithubTokens> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const answer = await refreshGithubTokens(
        config.webBase,
        config.clientId,
        refreshToken,
        fetchImpl,
        now
      )
      if (answer.ok || answer.error !== 'unreadable_response') {
        return answer
      }
    } catch {
      // Network failure, timeout or a 5xx: retried below.
    }
    const delay = REFRESH_RETRY_DELAYS_MS[attempt]
    if (delay === undefined) {
      throw new GithubUnreachable(GITHUB_UNREACHABLE)
    }
    await sleep(delay)
  }
}

function isStillStored(session: Session): boolean {
  return readStoredSession()?.refreshToken === session.refreshToken
}

async function refresh(
  config: ConfiguredApp,
  session: Session,
  fetchImpl: Fetch,
  now: () => number,
  sleep: Sleep
): Promise<string> {
  if (
    !session.refreshToken ||
    (session.refreshExpiresAt !== null && session.refreshExpiresAt <= now())
  ) {
    expire()
  }
  // Unreachable is not a refusal: the refresh token (good for months) stays, so a Mac that wakes
  // up offline with a run-out access token is signed in again as soon as the network is back.
  const answer = await requestRefresh(config, session.refreshToken, fetchImpl, now, sleep)
  // The request can take over a minute with retries. A sign-out, or a new sign-in, in that time
  // wins: a late answer must not bring the old session back or push its token into sandboxes.
  if (!isStillStored(session)) {
    throw new GithubSignInRequired(NOT_SIGNED_IN)
  }
  if (!answer.ok) {
    // GitHub answered and refused (a used or revoked refresh token, the app's settings changed):
    // the pair is dead, so say so instead of showing a connection that cannot push.
    expire()
  }
  writeSession({ ...session, ...answer.tokens })
  emit('rotated')
  return answer.tokens.accessToken
}

/**
 * The current access token, refreshed first when it is close to expiry. `staleToken` is the token
 * GitHub just refused (a 401): it forces a refresh, unless another caller already rotated past it.
 * Concurrent callers share one refresh, since GitHub kills the refresh token on first use.
 */
export async function githubAccessToken(
  options: { staleToken?: string; fetchImpl?: Fetch; now?: () => number; sleep?: Sleep } = {}
): Promise<string> {
  const now = options.now ?? Date.now
  const config = currentGithubAppConfig()
  if (!config.configured) {
    throw new GithubSignInRequired(config.message)
  }
  const session = readSession(config)
  if (!session) {
    if (sessionKeychainRefused()) {
      throw new GithubSignInRequired(KEYCHAIN_REFUSED)
    }
    throw new GithubSignInRequired(githubSignInExpired() ? SIGN_IN_AGAIN : NOT_SIGNED_IN)
  }
  const forced = options.staleToken !== undefined && options.staleToken === session.accessToken
  const fresh =
    session.accessExpiresAt === null || session.accessExpiresAt - now() > refreshMarginMs()
  if (!forced && fresh) {
    return session.accessToken
  }
  const stillValid = session.accessExpiresAt !== null && session.accessExpiresAt > now()
  if (!refreshing && now() < refreshUnreachableUntil) {
    if (!forced && stillValid) {
      return session.accessToken
    }
    throw new GithubUnreachable(GITHUB_UNREACHABLE)
  }
  refreshing ??= refresh(
    config,
    session,
    options.fetchImpl ?? fetch,
    now,
    options.sleep ?? sleepFor
  )
    .catch((error: unknown) => {
      if (error instanceof GithubUnreachable) {
        refreshUnreachableUntil = now() + REFRESH_UNREACHABLE_COOLDOWN_MS
        // Inside the margin the old token still works: hand it out rather than closing GitHub to
        // every running sandbox over a refresh the keeper retries on its next tick.
        if (!forced && stillValid) {
          return session.accessToken
        }
      }
      throw error
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

/** Both tokens, for the list of secrets that must never reach a sandbox. */
export function readGithubSessionSecrets(): string[] {
  const session = readStoredSession()
  return session ? [session.accessToken, session.refreshToken].filter((t): t is string => !!t) : []
}

/** When the access token runs out; null when signed out or the app's tokens never expire. */
export function githubAccessExpiresAt(): number | null {
  return readSession()?.accessExpiresAt ?? null
}

/** The access token already unsealed, if it has not run out; never refreshes, never throws. */
export function githubPeekAccessToken(now: () => number = Date.now): string | null {
  const config = currentGithubAppConfig()
  if (!config.configured) {
    return null
  }
  const session = readSession(config)
  if (!session || (session.accessExpiresAt !== null && session.accessExpiresAt <= now())) {
    return null
  }
  return session.accessToken
}
