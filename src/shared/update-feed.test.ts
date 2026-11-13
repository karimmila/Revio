import { describe, expect, it } from 'vitest'
import forkIdentity from './fork-identity.json'
import { getUpdateFeedUrls, parseUpdateFeedRepo } from './update-feed'

describe('update feed', () => {
  it('ships with no feed, so packaged fork builds never update from upstream', () => {
    expect(forkIdentity.updateFeedGitHubRepo).toBeNull()
  })

  it('accepts only a plain GitHub owner/repo', () => {
    expect(parseUpdateFeedRepo('acme/orca-fork')).toBe('acme/orca-fork')
    expect(parseUpdateFeedRepo(' acme/orca.fork ')).toBe('acme/orca.fork')
    expect(parseUpdateFeedRepo(null)).toBeNull()
    expect(parseUpdateFeedRepo('')).toBeNull()
    expect(parseUpdateFeedRepo('acme')).toBeNull()
    expect(parseUpdateFeedRepo('acme/orca/extra')).toBeNull()
    expect(parseUpdateFeedRepo('https://github.com/acme/orca')).toBeNull()
  })

  it('derives every release URL from the one repo value', () => {
    expect(getUpdateFeedUrls('acme/orca-fork')).toEqual({
      latestDownload: 'https://github.com/acme/orca-fork/releases/latest/download',
      latestRelease: 'https://github.com/acme/orca-fork/releases/latest',
      releasesAtom: 'https://github.com/acme/orca-fork/releases.atom',
      releaseDownloadBase: 'https://github.com/acme/orca-fork/releases/download',
      releaseTagPathPrefix: '/acme/orca-fork/releases/tag/'
    })
  })
})
