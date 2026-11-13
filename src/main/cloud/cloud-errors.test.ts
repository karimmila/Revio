import { describe, expect, it } from 'vitest'
import { humanCloudError, redactSecrets } from './cloud-errors'

describe('cloud errors and network', () => {
  it('never lets a credential through', () => {
    const text = redactSecrets(
      'failed: ghs_abcdefghijklmnop1234 sk-ant-oat01-abcdefghijklmnopqrst vca_abcdefghijklmnop Basic eC1hY2Nlc3MtdG9rZW46Z2hzX3h4eA== Bearer abcdefghijklmnopqrstuv'
    )
    expect(text).not.toMatch(/ghs_|sk-ant|vca_|eC1hY2Nl|abcdefghijklmnopqrstuv/)
    // The GitHub App's user and refresh tokens.
    expect(redactSecrets('ghu_abcdefghijklmnop1234 ghr_abcdefghijklmnop1234')).toBe(
      '[redacted] [redacted]'
    )
  })

  it('turns API failures into sentences a person can act on', () => {
    expect(humanCloudError(Object.assign(new Error('x'), { status: 401 }))).toMatch(
      /Reconnect Vercel/
    )
    expect(humanCloudError(Object.assign(new Error('x'), { status: 404 }))).toMatch(
      /Archive the workspace/
    )
    expect(humanCloudError(Object.assign(new Error('x'), { status: 404 }), 'snapshot')).toMatch(
      /Rebuild/
    )
    expect(
      humanCloudError(
        new Error('Your GitHub sign-in expired. Sign in again in Settings > Account.')
      )
    ).toMatch(/Sign in again/)
    expect(
      humanCloudError(
        Object.assign(
          new Error(
            'Status code 402 is not ok: Hobby plan usage limit exceeded for Snapshots Storage. Limit will be reset on 2026-12-01T00:00:00.000Z.'
          ),
          { status: 402 }
        )
      )
    ).toBe(
      'Vercel refused: Hobby plan usage limit exceeded for Snapshots Storage. Limit will be reset on 2026-12-01T00:00:00.000Z.'
    ) // Humanized twice (where the create fails and on the way out), it still says it once.
    expect(
      humanCloudError(
        new Error('Vercel refused: Hobby plan usage limit exceeded. Limit will be reset soon.')
      )
    ).toBe('Vercel refused: Hobby plan usage limit exceeded. Limit will be reset soon.')
  })

  it('names the next step for an offline Mac and for a Vercel rate limit', () => {
    expect(humanCloudError(new TypeError('fetch failed'))).toBe(
      'Could not reach Vercel. Check your internet connection and try again.'
    )
    expect(humanCloudError(Object.assign(new Error('Too Many Requests'), { status: 429 }))).toBe(
      'Vercel is limiting requests right now. Wait a minute, then try again.'
    )
    expect(
      humanCloudError(
        Object.assign(
          new Error('Status code 402 is not ok: Sandbox limit reached for the Hobby plan'),
          {
            status: 402
          }
        )
      )
    ).toBe('Vercel refused: Sandbox limit reached for the Hobby plan')
  })
})
