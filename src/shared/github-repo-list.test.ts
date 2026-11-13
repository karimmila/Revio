import { describe, expect, it } from 'vitest'
import { filterGithubRepos, parseGithubRepoList } from './github-repo-list'

describe('GitHub repo list', () => {
  it('parses gh JSON and skips bad rows', () => {
    expect(
      parseGithubRepoList(
        JSON.stringify([
          { nameWithOwner: 'a/b', url: 'https://github.com/a/b', isPrivate: true },
          { nameWithOwner: 3 }
        ])
      )
    ).toEqual([{ nameWithOwner: 'a/b', url: 'https://github.com/a/b', isPrivate: true }])
    expect(parseGithubRepoList('oops')).toEqual([])
    expect(
      parseGithubRepoList(
        JSON.stringify([
          null,
          { nameWithOwner: 'c/d', url: 'u', isPrivate: 'yes' },
          { nameWithOwner: 'e/f', url: 'v' }
        ])
      )
    ).toEqual([
      { nameWithOwner: 'c/d', url: 'u', isPrivate: false },
      { nameWithOwner: 'e/f', url: 'v', isPrivate: false }
    ])
  })

  it('filters by every word and caps the list', () => {
    const repos = ['acme/web', 'acme/api', 'me/web-tools'].map((name) => ({
      nameWithOwner: name,
      url: `https://github.com/${name}`,
      isPrivate: false
    }))
    expect(filterGithubRepos(repos, 'acme web').map((r) => r.nameWithOwner)).toEqual(['acme/web'])
    expect(filterGithubRepos(repos, '', 2)).toHaveLength(2)
  })
})
