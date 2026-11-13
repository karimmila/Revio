import { describe, expect, it } from 'vitest'
import { releaseNoticeRepo } from './release-notice'

describe('releaseNoticeRepo', () => {
  it('is off when the build names no repository or a malformed one', () => {
    expect(releaseNoticeRepo({ releasesRepo: null })).toBeNull()
    expect(releaseNoticeRepo({ releasesRepo: 'https://evil.example/owner/repo' })).toBeNull()
    expect(releaseNoticeRepo({ releasesRepo: 'owner/repo/extra' })).toBeNull()
  })

  it('accepts owner/repo', () => {
    expect(releaseNoticeRepo({ releasesRepo: 'karimmila/Revio' })).toBe('karimmila/Revio')
  })
})
