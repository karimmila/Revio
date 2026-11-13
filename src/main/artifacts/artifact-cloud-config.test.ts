import { describe, expect, it } from 'vitest'
import { FORK_IDENTITY, type ForkServices } from '../../shared/fork-identity'
import {
  ARTIFACT_SHARING_OFF_MESSAGE,
  allowsArtifactCloudAuthOverride,
  isArtifactCloudEnabled,
  resolveArtifactCloudApiUrl
} from './artifact-cloud-config'

const SHARE_ON: ForkServices = {
  ...FORK_IDENTITY.services,
  shareBaseUrl: 'https://share.revio.example'
}

describe('resolveArtifactCloudApiUrl', () => {
  it('is off by default, and no override or env var turns it on', () => {
    expect(isArtifactCloudEnabled()).toBe(false)
    expect(() => resolveArtifactCloudApiUrl()).toThrow(ARTIFACT_SHARING_OFF_MESSAGE)
    expect(() =>
      resolveArtifactCloudApiUrl(
        'http://127.0.0.1:45961',
        { ORCA_ARTIFACTS_API_URL: 'http://127.0.0.1:45961' },
        false
      )
    ).toThrow(ARTIFACT_SHARING_OFF_MESSAGE)
  })

  it('uses the fork share origin when it is on', () => {
    expect(resolveArtifactCloudApiUrl(undefined, {}, true, SHARE_ON)).toBe(
      'https://share.revio.example'
    )
  })

  it('allows loopback HTTP only in development', () => {
    expect(
      resolveArtifactCloudApiUrl(
        undefined,
        { ORCA_ARTIFACTS_API_URL: 'http://127.0.0.1:45961' },
        false,
        SHARE_ON
      )
    ).toBe('http://127.0.0.1:45961')
    expect(() => resolveArtifactCloudApiUrl('http://127.0.0.1:45961', {}, true, SHARE_ON)).toThrow(
      /HTTPS/
    )
  })

  it('rejects origins that could receive an access token', () => {
    expect(() => resolveArtifactCloudApiUrl('https://example.com', {}, false, SHARE_ON)).toThrow(
      /share\.revio\.example/
    )
    expect(() =>
      resolveArtifactCloudApiUrl('https://share.onorca.dev', {}, false, SHARE_ON)
    ).toThrow(/share\.revio\.example/)
    expect(() =>
      resolveArtifactCloudApiUrl('https://share.revio.example/path', {}, false, SHARE_ON)
    ).toThrow(/origin/)
  })

  it('allows auth token overrides only in non-production development builds', () => {
    expect(allowsArtifactCloudAuthOverride({}, false)).toBe(true)
    expect(allowsArtifactCloudAuthOverride({ NODE_ENV: 'production' }, false)).toBe(false)
    expect(allowsArtifactCloudAuthOverride({}, true)).toBe(false)
  })
})
