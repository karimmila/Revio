import { describe, expect, it } from 'vitest'
import type {
  CloudGithubRepoCoverage,
  CloudGithubStatus
} from '../../../../../shared/cloud/cloud-types'
import { allGithubReposCovered, githubAvatarUrl, githubRepoRows } from './revio-cloud-github-view'

function repo(patch: Partial<CloudGithubRepoCoverage>): CloudGithubRepoCoverage {
  return {
    repoId: 'r',
    owner: 'acme',
    name: 'app',
    state: 'not-covered',
    installUrl: 'https://github.com/apps/x/installations/new',
    ...patch
  }
}

function status(patch: Partial<CloudGithubStatus> = {}): CloudGithubStatus {
  return {
    app: {
      configured: true,
      host: 'github.com',
      slug: 'x',
      custom: false,
      authorizationsUrl: 'https://github.com/settings/apps/authorizations'
    },
    account: null,
    signInExpired: false,
    signIn: null,
    repos: [],
    pendingInstallOwner: null,
    coverageError: null,
    migrated: false,
    ...patch
  }
}

describe('githubAvatarUrl', () => {
  it('uses the app host, so GitHub Enterprise Server avatars load too', () => {
    expect(githubAvatarUrl('github.com', 'octo cat')).toBe(
      'https://github.com/octo%20cat.png?size=64'
    )
    expect(githubAvatarUrl('ghe.example.com', 'me')).toBe('https://ghe.example.com/me.png?size=64')
  })
})

describe('githubRepoRows', () => {
  it('offers one install per owner, case-insensitively, only for uncovered repos with a URL', () => {
    const rows = githubRepoRows([
      repo({ repoId: '1', owner: 'Acme', state: 'covered' }),
      repo({ repoId: '2', owner: 'acme' }),
      repo({ repoId: '3', owner: 'ACME' }),
      repo({ repoId: '4', owner: 'solo', installUrl: null }),
      repo({ repoId: '5', owner: 'solo', state: 'unknown' })
    ])
    expect(rows.map((row) => [row.repoId, row.offerInstall])).toEqual([
      ['1', false],
      ['2', true],
      ['3', false],
      ['4', false],
      ['5', true]
    ])
  })
})

describe('allGithubReposCovered', () => {
  it('needs at least one repo and every repo covered', () => {
    expect(allGithubReposCovered(status())).toBe(false)
    expect(allGithubReposCovered(status({ repos: [repo({ state: 'covered' })] }))).toBe(true)
    expect(
      allGithubReposCovered(
        status({ repos: [repo({ state: 'covered' }), repo({ repoId: '2', state: 'unknown' })] })
      )
    ).toBe(false)
  })
})
