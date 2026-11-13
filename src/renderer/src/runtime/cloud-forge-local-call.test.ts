import { describe, expect, it } from 'vitest'
import { cloudForgeLocalParams } from './cloud-forge-local-call'

const sandbox = { kind: 'environment' as const, environmentId: 'env-cloud' }
const sourceRepoId = (environmentId: string): string | null =>
  environmentId === 'env-cloud' ? 'local-repo-1' : null

describe('cloudForgeLocalParams', () => {
  it("runs a cloud workspace's pull request lookup on this Mac against the source repository", () => {
    expect(
      cloudForgeLocalParams(
        sandbox,
        'hostedReview.forBranch',
        { repo: 'sandbox-repo-9', branch: 'feature/login', worktree: 'path:/vercel/sandbox/app' },
        sourceRepoId
      )
    ).toEqual({ params: { repo: 'local-repo-1', branch: 'feature/login' } })
  })

  it('covers checks, review comments, merges and state changes', () => {
    for (const method of [
      'github.prChecks',
      'github.prComments',
      'github.mergePR',
      'github.updatePRState',
      'github.markPRReadyForReview',
      'hostedReview.getCreationEligibility'
    ]) {
      expect(
        cloudForgeLocalParams(
          sandbox,
          method,
          { repo: 'sandbox-repo-9', prNumber: 4 },
          sourceRepoId
        )
      ).toEqual({ params: { repo: 'local-repo-1', prNumber: 4 } })
    }
  })

  it('leaves calls that need the sandbox checkout, and every non-GitHub call, in the sandbox', () => {
    expect(
      cloudForgeLocalParams(
        sandbox,
        'hostedReview.create',
        { repo: 'sandbox-repo-9' },
        sourceRepoId
      )
    ).toBeNull()
    expect(
      cloudForgeLocalParams(sandbox, 'git.status', { worktree: 'id:w' }, sourceRepoId)
    ).toBeNull()
    expect(
      cloudForgeLocalParams(sandbox, 'gitlab.mrForBranch', { repo: 'sandbox-repo-9' }, sourceRepoId)
    ).toBeNull()
  })

  it('never redirects a paired server that is not a cloud sandbox, or a local call', () => {
    const paired = { kind: 'environment' as const, environmentId: 'env-teammate' }
    expect(
      cloudForgeLocalParams(paired, 'github.prChecks', { repo: 'r', prNumber: 4 }, sourceRepoId)
    ).toBeNull()
    expect(
      cloudForgeLocalParams({ kind: 'local' }, 'github.prChecks', { repo: 'r' }, sourceRepoId)
    ).toBeNull()
  })

  it('passes calls without a repository through unchanged', () => {
    expect(cloudForgeLocalParams(sandbox, 'github.rateLimit', undefined, sourceRepoId)).toEqual({
      params: undefined
    })
  })
})
