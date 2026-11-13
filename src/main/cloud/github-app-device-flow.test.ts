import { describe, expect, it } from 'vitest'
import { DeviceFlowError, pollDeviceToken, requestDeviceCode } from './github-app-device-flow'

const WEB = 'https://github.com'

function answering(bodies: unknown[]): { fetchImpl: typeof fetch; calls: URLSearchParams[] } {
  const calls: URLSearchParams[] = []
  const fetchImpl: typeof fetch = async (_input, init) => {
    calls.push(new URLSearchParams(String(init?.body)))
    return new Response(JSON.stringify(bodies.shift() ?? {}), { status: 200 })
  }
  return { fetchImpl, calls }
}

function clock(): { now: () => number; sleep: (ms: number) => Promise<void>; slept: number[] } {
  let time = 0
  const slept: number[] = []
  return {
    now: () => time,
    sleep: async (ms) => {
      slept.push(ms)
      time += ms
    },
    slept
  }
}

const code = {
  deviceCode: 'dev',
  userCode: 'ABCD-1234',
  verificationUri: 'https://github.com/login/device',
  expiresAt: 900_000,
  intervalMs: 5_000
}

describe('device flow', () => {
  it('asks for a code with the client id only', async () => {
    const { fetchImpl, calls } = answering([
      {
        device_code: 'dev',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5
      }
    ])
    const result = await requestDeviceCode(WEB, 'Iv23liClient', fetchImpl, () => 1_000)
    expect(result).toMatchObject({ userCode: 'ABCD-1234', expiresAt: 901_000, intervalMs: 5_000 })
    expect(Object.fromEntries(calls[0])).toEqual({ client_id: 'Iv23liClient' })
  })

  it('explains a disabled device flow', async () => {
    const { fetchImpl } = answering([{ error: 'device_flow_disabled' }])
    await expect(requestDeviceCode(WEB, 'Iv23liClient', fetchImpl)).rejects.toThrow(
      /device flow turned on/
    )
  })

  it('waits through pending and slows down when told to', async () => {
    const { fetchImpl, calls } = answering([
      { error: 'authorization_pending' },
      { error: 'slow_down', interval: 10 },
      {
        access_token: 'ghu_new',
        refresh_token: 'ghr_new',
        expires_in: 28_800,
        refresh_token_expires_in: 15_897_600
      }
    ])
    const time = clock()
    const tokens = await pollDeviceToken(WEB, 'Iv23liClient', code, { fetchImpl, ...time })
    expect(time.slept).toEqual([5_000, 5_000, 10_000])
    expect(tokens).toEqual({
      accessToken: 'ghu_new',
      refreshToken: 'ghr_new',
      accessExpiresAt: 20_000 + 28_800_000,
      refreshExpiresAt: 20_000 + 15_897_600_000
    })
    expect(calls[0].get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:device_code')
    expect(calls[0].get('client_secret')).toBeNull()
  })

  it.each([
    ['expired_token', 'expired'],
    ['access_denied', 'denied'],
    ['incorrect_device_code', 'failed']
  ])('stops on %s', async (error, reason) => {
    const { fetchImpl } = answering([{ error }])
    const result = pollDeviceToken(WEB, 'Iv23liClient', code, { fetchImpl, ...clock() })
    await expect(result).rejects.toBeInstanceOf(DeviceFlowError)
    await expect(result).rejects.toMatchObject({ reason })
  })

  it('stops when the code runs out locally, and when cancelled', async () => {
    const { fetchImpl } = answering(
      Array.from({ length: 400 }, () => ({ error: 'authorization_pending' }))
    )
    await expect(
      pollDeviceToken(
        WEB,
        'Iv23liClient',
        { ...code, expiresAt: 12_000 },
        { fetchImpl, ...clock() }
      )
    ).rejects.toMatchObject({ reason: 'expired' })
    const abort = new AbortController()
    abort.abort()
    await expect(
      pollDeviceToken(WEB, 'Iv23liClient', code, { fetchImpl, ...clock(), signal: abort.signal })
    ).rejects.toMatchObject({ reason: 'cancelled' })
  })
  it('keeps polling through a dropped connection and a busy GitHub, slower each time', async () => {
    const answers: (() => Response)[] = [
      () => {
        throw new TypeError('fetch failed')
      },
      () => new Response('', { status: 503 }),
      () => new Response('', { status: 429, headers: { 'retry-after': '30' } }),
      () => new Response(JSON.stringify({ access_token: 'ghu_token' }), { status: 200 })
    ]
    const fetchImpl: typeof fetch = async () => answers.shift()!()
    const time = clock()

    const tokens = await pollDeviceToken(WEB, 'Iv23liClient', code, { fetchImpl, ...time })

    expect(tokens.accessToken).toBe('ghu_token')
    expect(time.slept).toEqual([5_000, 10_000, 15_000, 30_000])
  })

  it('says to check the connection when the sign-in cannot start offline', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError('fetch failed')
    }
    await expect(requestDeviceCode(WEB, 'Iv23liClient', fetchImpl)).rejects.toThrow(
      'Could not reach GitHub. Check your internet connection and try again.'
    )
  })

  it('still ends when the code expires while GitHub is unreachable', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError('fetch failed')
    }
    await expect(
      pollDeviceToken(WEB, 'Iv23liClient', code, { fetchImpl, ...clock() })
    ).rejects.toMatchObject({ reason: 'expired' })
  })
})
