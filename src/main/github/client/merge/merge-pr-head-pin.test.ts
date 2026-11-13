import { expect, it, vi } from 'vitest'

const gh = vi.hoisted(() => ({ exec: vi.fn(async () => ({ stdout: '' })) }))
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
    ghOptions: {}
  }))
}))
vi.mock('./../lookup/pr-number-lookup', () => ({
  getRestPRByNumber: vi.fn(async () => ({})),
  getPRByNumber: vi.fn(async () => null)
}))

import { mergePR } from './merge-pr'

it('pins the merge to the workspace HEAD (gh mocked, nothing is sent)', async () => {
  await expect(mergePR('/repo', 7, 'squash', null, null, {}, 'abc1234')).resolves.toEqual({
    ok: true
  })
  expect(gh.exec).toHaveBeenCalledWith(
    ['pr', 'merge', '7', '--squash', '--match-head-commit', 'abc1234', '--repo', 'acme/web'],
    expect.anything()
  )
})
