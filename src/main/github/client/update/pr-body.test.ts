import { expect, it, vi } from 'vitest'

const gh = vi.hoisted(() => ({ exec: vi.fn() }))
vi.mock('../../gh-utils', () => ({ ghExecFileAsync: gh.exec }))
vi.mock('../../github-api-repository', () => ({
  resolveGitHubRepoExecution: vi.fn(async () => ({
    ownerRepo: { owner: 'acme', repo: 'web' },
    ghOptions: {}
  }))
}))

import { getPRBody } from './pr-body'

it('reads the PR description through gh (mocked) and trims the final newline', async () => {
  gh.exec.mockResolvedValueOnce({ stdout: 'Fixes #1\n\nDetails\n' })
  await expect(getPRBody('/repo', 9)).resolves.toBe('Fixes #1\n\nDetails')
  expect(gh.exec).toHaveBeenCalledWith(
    ['pr', 'view', '9', '--json', 'body', '--jq', '.body', '--repo', 'acme/web'],
    {}
  )
})

it('is null when gh fails', async () => {
  gh.exec.mockRejectedValueOnce(new Error('offline'))
  await expect(getPRBody('/repo', 9)).resolves.toBeNull()
})
