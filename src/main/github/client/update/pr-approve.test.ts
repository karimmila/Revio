import { beforeEach, expect, it, vi } from 'vitest'

const gh = vi.hoisted(() => ({ exec: vi.fn() }))
vi.mock('../../gh-utils', () => ({
  ghExecFileAsync: gh.exec,
  acquire: vi.fn(async () => {}),
  release: vi.fn()
}))
vi.mock('../../pr-mutation-review-invalidation', () => ({
  invalidateReviewLookupsAfterPRMutation: vi.fn()
}))
vi.mock('../../github-api-repository', () => ({
  resolveGitHubRepoExecution: vi.fn(async () => ({
    ownerRepo: { owner: 'acme', repo: 'web' },
    ghOptions: { cwd: '/repo' }
  }))
}))

import { approvePR } from './pr-approve'

beforeEach(() => gh.exec.mockReset())

it('approves through gh pr review on the named repository (gh mocked, nothing is sent)', async () => {
  gh.exec.mockResolvedValue({ stdout: '' })
  await expect(approvePR('/repo', 42)).resolves.toEqual({ ok: true })
  expect(gh.exec).toHaveBeenCalledWith(
    ['pr', 'review', '42', '--approve', '--repo', 'acme/web'],
    expect.objectContaining({ cwd: '/repo' })
  )
})

it('reports a gh failure', async () => {
  gh.exec.mockRejectedValueOnce(new Error('approval refused'))
  const result = await approvePR('/repo', 42)
  expect(result).toEqual({ ok: false, error: 'approval refused' })
})
