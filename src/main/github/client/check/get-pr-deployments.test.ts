import { beforeEach, describe, expect, it, vi } from 'vitest'

const ghMock = vi.hoisted(() => vi.fn())
vi.mock('../../gh-utils', () => ({
  ghExecFileAsync: ghMock,
  acquire: vi.fn(async () => {}),
  release: vi.fn()
}))
vi.mock('../../github-repository-identity', () => ({
  withGitHubRepoExecution: (_path: string, _id: unknown, _opts: unknown, run: () => unknown) =>
    run()
}))
vi.mock('../../github-api-repository', () => ({
  resolveGitHubRepoExecution: vi.fn(async () => ({
    ownerRepo: { owner: 'o', repo: 'r' },
    ghOptions: {}
  }))
}))

import { getPRDeployments, latestPerEnvironment } from './get-pr-deployments'

beforeEach(() => {
  ghMock.mockReset()
})

describe('getPRDeployments', () => {
  it('keeps the newest deployment per environment', () => {
    expect(
      latestPerEnvironment([
        { id: 3, environment: 'preview' },
        { id: 2, environment: 'preview' },
        { id: 1, environment: 'production' },
        { id: 'x', environment: 'bad' }
      ]).map((d) => d.id)
    ).toEqual([3, 1])
  })

  it('reads deployments and their latest status with GET calls only', async () => {
    ghMock.mockImplementation(async (args: string[]) => {
      if (args[1].includes('/statuses')) {
        return { stdout: JSON.stringify([{ state: 'success', environment_url: 'https://p.dev' }]) }
      }
      return {
        stdout: JSON.stringify([{ id: 7, environment: 'preview', created_at: '2026-11-09' }])
      }
    })
    const result = await getPRDeployments('/repo', 'abc1234', null)
    expect(result).toEqual([
      {
        id: 7,
        environment: 'preview',
        state: 'success',
        url: 'https://p.dev',
        createdAt: '2026-11-09'
      }
    ])
    for (const [args] of ghMock.mock.calls) {
      expect(args).not.toContain('-X')
    }
    expect(ghMock.mock.calls[0][0][1]).toBe('repos/o/r/deployments?sha=abc1234&per_page=30')
  })

  it('returns nothing for a bad sha or a failed read', async () => {
    expect(await getPRDeployments('/repo', 'not a sha', null)).toEqual([])
    ghMock.mockRejectedValue(new Error('gh failed'))
    expect(await getPRDeployments('/repo', 'abc1234', null)).toEqual([])
  })
})
