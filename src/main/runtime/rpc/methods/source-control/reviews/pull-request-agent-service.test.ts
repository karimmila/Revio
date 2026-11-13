import { describe, expect, it, vi } from 'vitest'
import type { HostedReviewCreationEligibility } from '../../../../../../shared/source-control/hosted-review/hosted-review-contracts'
import {
  createWorkspacePullRequest,
  pushWorkspaceBranch,
  type PullRequestAgentDeps
} from './pull-request-agent-service'

const eligible: HostedReviewCreationEligibility = {
  provider: 'github',
  review: null,
  canCreate: false,
  blockedReason: null,
  nextAction: null,
  reviewLookupOutcome: 'not_found',
  defaultBaseRef: 'origin/main'
}

function deps(overrides: Partial<PullRequestAgentDeps> = {}) {
  const calls: string[] = []
  const value: PullRequestAgentDeps = {
    showWorktree: async () => ({ id: 'r1::/w', repoId: 'r1', branch: 'refs/heads/feature/login' }),
    githubBlock: async () => null,
    eligibility: vi.fn(async () => {
      calls.push('eligibility')
      return eligible
    }),
    push: vi.fn(async () => {
      calls.push('push')
    }),
    create: vi.fn(async () => {
      calls.push('create')
      return { ok: true as const, number: 12, url: 'https://github.com/acme/app/pull/12' }
    }),
    ...overrides
  }
  return { value, calls }
}

const request = { worktree: 'id:r1::/w', title: 'Add login' }

describe('pullRequest.create', () => {
  it("pushes the workspace's branch, then opens the pull request against the default base", async () => {
    const { value, calls } = deps()

    const result = await createWorkspacePullRequest(value, { ...request, body: 'Why', draft: true })

    expect(result).toEqual({
      url: 'https://github.com/acme/app/pull/12',
      number: 12,
      branch: 'feature/login',
      created: true
    })
    expect(calls).toEqual(['eligibility', 'push', 'create'])
    expect(value.create).toHaveBeenCalledWith({
      repoId: 'r1',
      worktreeId: 'r1::/w',
      base: 'main',
      head: 'feature/login',
      title: 'Add login',
      body: 'Why',
      draft: true
    })
  })

  it('pushes to a branch that already has a pull request and returns that one', async () => {
    const { value, calls } = deps({
      eligibility: async () => ({
        ...eligible,
        review: { number: 7, url: 'https://github.com/acme/app/pull/7' }
      })
    })

    const result = await createWorkspacePullRequest(value, request)

    expect(result).toEqual({
      url: 'https://github.com/acme/app/pull/7',
      number: 7,
      branch: 'feature/login',
      created: false
    })
    expect(calls).toEqual(['push'])
  })

  it('returns the sign-in or install guidance before any push', async () => {
    for (const block of [
      'Sign in with GitHub in Revio Settings > Cloud.',
      'Install Revio on acme to use GitHub features for this repository.'
    ]) {
      const { value, calls } = deps({ githubBlock: async () => block })
      await expect(createWorkspacePullRequest(value, request)).rejects.toThrow(block)
      expect(calls).toEqual([])
    }
  })

  it('refuses a detached workspace and a workspace on the base branch', async () => {
    const detached = deps({ showWorktree: async () => ({ id: 'w', repoId: 'r1', branch: 'HEAD' }) })
    await expect(createWorkspacePullRequest(detached.value, request)).rejects.toThrow(
      'This workspace is not on a branch.'
    )
    const onBase = deps({
      showWorktree: async () => ({ id: 'w', repoId: 'r1', branch: 'main' })
    })
    await expect(createWorkspacePullRequest(onBase.value, request)).rejects.toThrow(
      'This workspace is on main, the base branch.'
    )
    expect([...detached.calls, ...onBase.calls]).toEqual(['eligibility'])
  })

  it('reports why GitHub or the branch state refused the pull request', async () => {
    const { value } = deps({
      create: async () => ({
        ok: false as const,
        code: 'validation' as const,
        error: 'Create PR failed: commit your changes first.'
      })
    })
    await expect(createWorkspacePullRequest(value, request)).rejects.toThrow(
      'Create PR failed: commit your changes first.'
    )
  })

  it('opens pull requests on GitHub only', async () => {
    const { value, calls } = deps({
      eligibility: async () => ({ ...eligible, provider: 'gitlab' })
    })
    await expect(createWorkspacePullRequest(value, request)).rejects.toThrow(
      'GitHub repositories only'
    )
    expect(calls).toEqual([])
  })
})

describe('pullRequest.push', () => {
  it("pushes only the selected workspace's branch", async () => {
    const { value } = deps()
    await expect(pushWorkspaceBranch(value, 'id:r1::/w')).resolves.toEqual({
      branch: 'feature/login'
    })
    expect(value.push).toHaveBeenCalledWith('r1::/w')
  })
})
