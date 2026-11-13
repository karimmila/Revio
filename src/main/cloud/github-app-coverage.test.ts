import { describe, expect, it } from 'vitest'
import { githubOwnerId, isRepoCovered, readGithubCoverage } from './github-app-coverage'
import type { GithubGet } from './github-app-api'

function repos(owner: string, from: number, count: number): unknown[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `repo-${from + index}`,
    owner: { login: owner }
  }))
}

/** Two installations; the first has 150 repositories, served 100 per page. */
function github(): { get: GithubGet; paths: string[] } {
  const paths: string[] = []
  const get: GithubGet = async (path) => {
    paths.push(path)
    const url = new URL(path, 'https://api.github.com')
    const page = Number(url.searchParams.get('page'))
    if (url.pathname === '/user/installations') {
      return Response.json({
        total_count: 2,
        installations: [
          { id: 1, account: { login: 'Acme', id: 100 } },
          { id: 2, account: { login: 'octo', id: 200 } }
        ]
      })
    }
    if (url.pathname === '/user/installations/1/repositories') {
      return Response.json({
        total_count: 150,
        repositories: page === 1 ? repos('Acme', 0, 100) : repos('Acme', 100, 50)
      })
    }
    if (url.pathname === '/user/installations/2/repositories') {
      return Response.json({ total_count: 1, repositories: repos('octo', 0, 1) })
    }
    if (url.pathname === '/users/someone') {
      return Response.json({ id: 999 })
    }
    return new Response('{}', { status: 404 })
  }
  return { get, paths }
}

describe('GitHub App coverage', () => {
  it('reads every page of every installation', async () => {
    const { get, paths } = github()
    const coverage = await readGithubCoverage(get, 5)
    expect(coverage.repos.size).toBe(151)
    expect(isRepoCovered(coverage, { owner: 'acme', name: 'REPO-149' })).toBe(true)
    expect(isRepoCovered(coverage, { owner: 'acme', name: 'repo-150' })).toBe(false)
    expect(isRepoCovered(coverage, { owner: 'octo', name: 'repo-0' })).toBe(true)
    expect(coverage.installedOwners.get('acme')).toBe(100)
    expect(coverage.checkedAt).toBe(5)
    expect(paths).toEqual([
      '/user/installations?per_page=100&page=1',
      '/user/installations/1/repositories?per_page=100&page=1',
      '/user/installations/1/repositories?per_page=100&page=2',
      '/user/installations/2/repositories?per_page=100&page=1'
    ])
  })

  it('fails loudly when GitHub refuses the listing', async () => {
    const get: GithubGet = async () => new Response('{}', { status: 500 })
    await expect(readGithubCoverage(get)).rejects.toThrow(/GitHub answered 500/)
  })

  it('looks up an owner id for the install page, null when unknown', async () => {
    const { get } = github()
    await expect(githubOwnerId(get, 'someone')).resolves.toBe(999)
    await expect(githubOwnerId(get, 'missing')).resolves.toBeNull()
  })
})
