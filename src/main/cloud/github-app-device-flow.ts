import { z } from 'zod'
import {
  GithubOAuthUnavailable,
  postOAuthForm,
  readOAuthAnswer,
  type GithubTokenSet
} from './github-app-oauth'

type Fetch = typeof fetch

export type DeviceCode = {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresAt: number
  intervalMs: number
}

const DeviceCodeSchema = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.string().url(),
  expires_in: z.number().positive(),
  interval: z.number().positive().optional()
})

/** GitHub's own floor between polls, and what slow_down adds to it. */
const MIN_INTERVAL_MS = 5_000
const SLOW_DOWN_STEP_MS = 5_000
/** A wait GitHub asks for is honoured up to this; the code's own expiry ends the loop anyway. */
const MAX_INTERVAL_MS = 60_000

export async function requestDeviceCode(
  webBase: string,
  clientId: string,
  fetchImpl: Fetch,
  now: () => number = Date.now
): Promise<DeviceCode> {
  const body = await postOAuthForm(
    webBase,
    '/login/device/code',
    { client_id: clientId },
    fetchImpl
  )
  const parsed = DeviceCodeSchema.safeParse(body)
  if (!parsed.success) {
    const error = z.object({ error: z.string() }).safeParse(body)
    throw new Error(
      error.success && error.data.error === 'device_flow_disabled'
        ? 'This GitHub App does not have device flow turned on.'
        : error.success && error.data.error === 'incorrect_client_credentials'
          ? 'GitHub does not know this GitHub App client ID.'
          : 'GitHub did not start the sign-in. Try again.'
    )
  }
  const data = parsed.data
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresAt: now() + data.expires_in * 1000,
    intervalMs: Math.max((data.interval ?? 5) * 1000, MIN_INTERVAL_MS)
  }
}

export class DeviceFlowError extends Error {
  constructor(
    readonly reason: 'expired' | 'denied' | 'cancelled' | 'failed',
    message: string
  ) {
    super(message)
  }
}

export type DeviceFlowDeps = {
  fetchImpl: Fetch
  sleep: (ms: number) => Promise<void>
  now: () => number
  signal?: AbortSignal
}

/**
 * Polls until the person enters the code on GitHub (or it expires, or they refuse). Follows
 * GitHub's pacing: never sooner than `interval`, and 5 s slower on every slow_down.
 */
export async function pollDeviceToken(
  webBase: string,
  clientId: string,
  code: DeviceCode,
  deps: DeviceFlowDeps
): Promise<GithubTokenSet> {
  let interval = code.intervalMs
  for (;;) {
    if (deps.signal?.aborted) {
      throw new DeviceFlowError('cancelled', 'Sign-in cancelled.')
    }
    if (deps.now() >= code.expiresAt) {
      throw new DeviceFlowError('expired', 'The GitHub code expired. Sign in again.')
    }
    await deps.sleep(interval)
    if (deps.signal?.aborted) {
      throw new DeviceFlowError('cancelled', 'Sign-in cancelled.')
    }
    let body: unknown
    try {
      body = await postOAuthForm(
        webBase,
        '/login/oauth/access_token',
        {
          client_id: clientId,
          device_code: code.deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        },
        deps.fetchImpl
      )
    } catch (error) {
      if (!(error instanceof GithubOAuthUnavailable)) {
        throw error
      }
      // The code is still good: a dropped connection or a busy GitHub must not end the sign-in
      // the person is in the middle of. Poll again, slower, until the code itself expires.
      interval = Math.min(
        Math.max(interval + SLOW_DOWN_STEP_MS, error.retryAfterMs ?? 0),
        MAX_INTERVAL_MS
      )
      continue
    }
    const answer = readOAuthAnswer(body, deps.now())
    if (answer.ok) {
      return answer.tokens
    }
    switch (answer.error) {
      case 'authorization_pending':
        continue
      case 'slow_down':
        interval = Math.max(
          interval + SLOW_DOWN_STEP_MS,
          answer.interval ? answer.interval * 1000 : 0
        )
        continue
      case 'expired_token':
        throw new DeviceFlowError('expired', 'The GitHub code expired. Sign in again.')
      case 'access_denied':
        throw new DeviceFlowError('denied', 'Sign-in was cancelled on GitHub.')
      case 'unreadable_response':
        // A proxy page or a cut-off body, not GitHub's verdict.
        interval = Math.min(interval + SLOW_DOWN_STEP_MS, MAX_INTERVAL_MS)
        continue
      default:
        throw new DeviceFlowError('failed', `GitHub refused the sign-in (${answer.error}).`)
    }
  }
}
