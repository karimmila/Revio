import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetSecretStoreForTests, setSecretStore } from '../../shared/secret-store'

const root = vi.hoisted(() => ({ dir: '' }))
vi.mock('./cloud-repo-store', () => ({ cloudDataRoot: () => root.dir }))

import {
  githubAccessToken,
  githubAccount,
  githubSignInExpired,
  GithubSignInRequired,
  onGithubSessionChange,
  readGithubSessionSecrets,
  REFRESH_MARGIN_MS,
  REFRESH_RETRY_DELAYS_MS,
  REFRESH_UNREACHABLE_COOLDOWN_MS,
  refreshMarginMs,
  saveGithubSession,
  signOutGithub
} from './github-app-session'
import { currentGithubAppConfig } from './github-app-settings'
import { githubAppGetter } from './github-app-api'

const HOUR = 3_600_000

function configured(): Extract<ReturnType<typeof currentGithubAppConfig>, { configured: true }> {
  const config = currentGithubAppConfig()
  if (!config.configured) {
    throw new Error('the fork ships a configured GitHub App')
  }
  return config
}

function signIn(accessExpiresAt: number | null, refreshExpiresAt: number | null = 1e15): void {
  saveGithubSession(
    configured(),
    { accessToken: 'ghu_old', refreshToken: 'ghr_old', accessExpiresAt, refreshExpiresAt },
    { login: 'octo', userId: 7 }
  )
}

/** GitHub's token endpoint: each refresh answers the next pair, counting the calls. */
function refresher(answers: unknown[]): { fetchImpl: typeof fetch; bodies: URLSearchParams[] } {
  const bodies: URLSearchParams[] = []
  const fetchImpl: typeof fetch = async (_input, init) => {
    bodies.push(new URLSearchParams(String(init?.body)))
    // Several turns of the microtask queue keep a refresh in flight while a second caller arrives.
    for (let turn = 0; turn < 5; turn++) {
      await Promise.resolve()
    }
    return new Response(JSON.stringify(answers.shift() ?? {}))
  }
  return { fetchImpl, bodies }
}

const rotated = {
  access_token: 'ghu_new',
  refresh_token: 'ghr_new',
  expires_in: 28_800,
  refresh_token_expires_in: 15_897_600
}

// A fixed clock: expiry arithmetic must not depend on when the test runs.
const NOW = Date.UTC(2026, 10, 10, 12)

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  root.dir = mkdtempSync(join(tmpdir(), 'gh-app-session-'))
  setSecretStore({
    isEncryptionAvailable: () => true,
    encryptString: (text) => Buffer.from(`sealed:${Buffer.from(text).toString('hex')}`),
    decryptString: (cipher) =>
      Buffer.from(cipher.toString('utf8').slice('sealed:'.length), 'hex').toString('utf8'),
    describeProtectionGap: () => null
  })
})

afterEach(() => {
  vi.useRealTimers()
  signOutGithub()
  rmSync(root.dir, { recursive: true, force: true })
  _resetSecretStoreForTests()
})

describe('GitHub App session', () => {
  it('returns the stored token while it is fresh', async () => {
    signIn(NOW + 2 * HOUR)
    const { fetchImpl, bodies } = refresher([])
    await expect(githubAccessToken({ fetchImpl })).resolves.toBe('ghu_old')
    expect(bodies).toHaveLength(0)
    expect(githubAccount()).toEqual({ login: 'octo', userId: 7 })
  })

  it('refreshes once for concurrent callers and rotates both tokens', async () => {
    signIn(NOW + 60_000)
    const events: string[] = []
    const off = onGithubSessionChange((event) => events.push(event))
    const { fetchImpl, bodies } = refresher([rotated, rotated])
    const results = await Promise.all([
      githubAccessToken({ fetchImpl }),
      githubAccessToken({ fetchImpl }),
      githubAccessToken({ fetchImpl })
    ])
    off()
    expect(results).toEqual(['ghu_new', 'ghu_new', 'ghu_new'])
    expect(bodies).toHaveLength(1)
    expect(bodies[0].get('grant_type')).toBe('refresh_token')
    expect(bodies[0].get('refresh_token')).toBe('ghr_old')
    expect(bodies[0].get('client_secret')).toBeNull()
    expect(events).toEqual(['rotated'])
    expect(readGithubSessionSecrets().sort()).toEqual(['ghr_new', 'ghu_new'])
    await expect(githubAccessToken({ fetchImpl })).resolves.toBe('ghu_new')
  })

  it('forces a refresh for the token GitHub refused, not for one already rotated', async () => {
    signIn(NOW + 2 * HOUR)
    const { fetchImpl, bodies } = refresher([rotated])
    await expect(githubAccessToken({ fetchImpl, staleToken: 'ghu_old' })).resolves.toBe('ghu_new')
    await expect(githubAccessToken({ fetchImpl, staleToken: 'ghu_old' })).resolves.toBe('ghu_new')
    expect(bodies).toHaveLength(1)
  })

  it('a sign-out during a refresh is not undone by the late answer', async () => {
    signIn(NOW + 60_000)
    const events: string[] = []
    const off = onGithubSessionChange((event) => events.push(event))
    const { fetchImpl } = refresher([rotated])
    const pending = githubAccessToken({ fetchImpl })
    signOutGithub()
    await expect(pending).rejects.toBeInstanceOf(GithubSignInRequired)
    off()
    expect(githubAccount()).toBeNull()
    expect(readGithubSessionSecrets()).toEqual([])
    expect(events).toEqual(['signed-out'])
    expect(githubSignInExpired()).toBe(false)
  })

  it('a refusal for the old session does not sign out a newer sign-in', async () => {
    signIn(NOW + 60_000)
    const { fetchImpl } = refresher([{ error: 'bad_refresh_token' }])
    const pending = githubAccessToken({ fetchImpl })
    saveGithubSession(
      configured(),
      {
        accessToken: 'ghu_second',
        refreshToken: 'ghr_second',
        accessExpiresAt: NOW + 2 * HOUR,
        refreshExpiresAt: 1e15
      },
      { login: 'octo', userId: 7 }
    )
    await expect(pending).rejects.toBeInstanceOf(GithubSignInRequired)
    expect(readGithubSessionSecrets()).toEqual(['ghu_second', 'ghr_second'])
    expect(githubSignInExpired()).toBe(false)
  })

  it('signs out with "Sign in again" when GitHub refuses the refresh token', async () => {
    signIn(NOW - 1)
    const events: string[] = []
    const off = onGithubSessionChange((event) => events.push(event))
    const { fetchImpl } = refresher([{ error: 'bad_refresh_token' }])
    await expect(githubAccessToken({ fetchImpl })).rejects.toBeInstanceOf(GithubSignInRequired)
    off()
    expect(events).toEqual(['expired'])
    expect(githubAccount()).toBeNull()
    expect(githubSignInExpired()).toBe(true)
    expect(readGithubSessionSecrets()).toEqual([])
    await expect(githubAccessToken({ fetchImpl })).rejects.toThrow(/Sign in again/)
  })

  it('expires on any refusal GitHub answers, such as a reused refresh token', async () => {
    signIn(NOW + 5 * 60_000)
    const { fetchImpl } = refresher([{ error: 'incorrect_client_credentials' }])
    await expect(githubAccessToken({ fetchImpl })).rejects.toThrow(/Sign in again/)
    expect(githubSignInExpired()).toBe(true)
  })

  it('retries an unreachable GitHub with backoff before giving up', async () => {
    signIn(NOW - 1)
    const delays: number[] = []
    let calls = 0
    const fetchImpl: typeof fetch = async () => {
      calls += 1
      if (calls < 3) {
        throw new Error('offline')
      }
      return new Response(JSON.stringify(rotated))
    }
    const sleep = async (ms: number): Promise<void> => {
      delays.push(ms)
    }
    await expect(githubAccessToken({ fetchImpl, sleep })).resolves.toBe('ghu_new')
    expect(delays).toEqual(REFRESH_RETRY_DELAYS_MS.slice(0, 2))
  })

  it('keeps handing out a still-valid token while GitHub stays unreachable', async () => {
    signIn(NOW + 5 * 60_000)
    const events: string[] = []
    const off = onGithubSessionChange((event) => events.push(event))
    const fetchImpl: typeof fetch = async () => {
      throw new Error('offline')
    }
    await expect(githubAccessToken({ fetchImpl, sleep: async () => {} })).resolves.toBe('ghu_old')
    off()
    expect(events).toEqual([])
    expect(githubAccount()).not.toBeNull()
    expect(githubSignInExpired()).toBe(false)
  })

  it('keeps the sign-in when GitHub stays unreachable past the token expiry', async () => {
    signIn(NOW - 1)
    const events: string[] = []
    const off = onGithubSessionChange((event) => events.push(event))
    const fetchImpl: typeof fetch = async () => new Response('', { status: 502 })
    await expect(githubAccessToken({ fetchImpl, sleep: async () => {} })).rejects.toThrow(
      /could not be reached/
    )
    expect(events).toEqual([])
    expect(githubAccount()).toEqual({ login: 'octo', userId: 7 })
    expect(githubSignInExpired()).toBe(false)

    // Back online after the cooldown: the kept refresh token signs in again without a new code.
    vi.setSystemTime(NOW + REFRESH_UNREACHABLE_COOLDOWN_MS)
    const online = refresher([rotated])
    await expect(githubAccessToken({ fetchImpl: online.fetchImpl })).resolves.toBe('ghu_new')
    off()
    expect(online.bodies[0].get('refresh_token')).toBe('ghr_old')
  })

  it('does not hammer GitHub while it is unreachable', async () => {
    signIn(NOW + 5 * 60_000)
    let calls = 0
    const fetchImpl: typeof fetch = async () => {
      calls += 1
      throw new Error('offline')
    }
    const sleep = async (): Promise<void> => {}
    await expect(githubAccessToken({ fetchImpl, sleep })).resolves.toBe('ghu_old')
    const afterFirst = calls
    await expect(githubAccessToken({ fetchImpl, sleep })).resolves.toBe('ghu_old')
    await expect(githubAccessToken({ fetchImpl, sleep })).resolves.toBe('ghu_old')
    expect(afterFirst).toBe(REFRESH_RETRY_DELAYS_MS.length + 1)
    expect(calls).toBe(afterFirst)

    vi.setSystemTime(NOW + REFRESH_UNREACHABLE_COOLDOWN_MS)
    await expect(githubAccessToken({ fetchImpl, sleep })).resolves.toBe('ghu_old')
    expect(calls).toBe(afterFirst * 2)
  })

  it('a refused 401 retry is not answered with the token GitHub refused', async () => {
    signIn(NOW + 2 * HOUR)
    const fetchImpl: typeof fetch = async () => {
      throw new Error('offline')
    }
    await expect(
      githubAccessToken({ fetchImpl, staleToken: 'ghu_old', sleep: async () => {} })
    ).rejects.toThrow(/could not be reached/)
    expect(githubAccount()).not.toBeNull()
  })

  it('stays expired across a restart until the next sign-in', async () => {
    signIn(NOW - 1)
    const { fetchImpl } = refresher([{ error: 'bad_refresh_token' }])
    await expect(githubAccessToken({ fetchImpl })).rejects.toBeInstanceOf(GithubSignInRequired)
    expect(githubSignInExpired()).toBe(true)
    signIn(NOW + 2 * HOUR)
    expect(githubSignInExpired()).toBe(false)
  })

  it('does not refresh with an expired refresh token', async () => {
    signIn(NOW - 1, NOW - 1)
    const { fetchImpl, bodies } = refresher([rotated])
    await expect(githubAccessToken({ fetchImpl })).rejects.toThrow(/Sign in again/)
    expect(bodies).toHaveLength(0)
  })

  it('retries an API call once with a refreshed token after a 401', async () => {
    signIn(NOW + 2 * HOUR)
    const seen: string[] = []
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes('/login/oauth/access_token')) {
        return new Response(JSON.stringify(rotated))
      }
      const auth = new Headers(init?.headers).get('authorization') ?? ''
      seen.push(auth)
      return new Response('{}', { status: auth === 'Bearer ghu_new' ? 200 : 401 })
    }
    const response = await githubAppGetter(fetchImpl)('/user')
    expect(response.status).toBe(200)
    expect(seen).toEqual(['Bearer ghu_old', 'Bearer ghu_new'])
  })
})

describe('refreshMarginMs', () => {
  it('honours the dev override only in development', () => {
    expect(
      refreshMarginMs({ NODE_ENV: 'development', ORCA_DEV_GITHUB_REFRESH_MARGIN_MS: '28800000' })
    ).toBe(28_800_000)
    expect(
      refreshMarginMs({ NODE_ENV: 'production', ORCA_DEV_GITHUB_REFRESH_MARGIN_MS: '28800000' })
    ).toBe(REFRESH_MARGIN_MS)
    expect(
      refreshMarginMs({ NODE_ENV: 'development', ORCA_DEV_GITHUB_REFRESH_MARGIN_MS: 'x' })
    ).toBe(REFRESH_MARGIN_MS)
  })
})
