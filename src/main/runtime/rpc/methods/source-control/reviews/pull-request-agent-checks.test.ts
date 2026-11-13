import { describe, expect, it, vi } from 'vitest'
import type { PRCheckDetail, PRCheckRunDetails } from '../../../../../../shared/github/check-types'
import type { HostedReviewCreationEligibility } from '../../../../../../shared/source-control/hosted-review/hosted-review-contracts'
import {
  MAX_FAILING_CHECKS_WITH_LOGS,
  readWorkspacePullRequestChecks,
  type PullRequestChecksDeps
} from './pull-request-agent-checks'

const withReview: HostedReviewCreationEligibility = {
  provider: 'github',
  review: { number: 7, url: 'https://github.com/acme/app/pull/7' },
  canCreate: false,
  blockedReason: null,
  nextAction: null,
  reviewLookupOutcome: 'found',
  defaultBaseRef: 'origin/main'
}

function check(name: string, conclusion: PRCheckDetail['conclusion']): PRCheckDetail {
  return {
    name,
    status: conclusion === 'pending' ? 'in_progress' : 'completed',
    conclusion,
    url: `https://github.com/acme/app/runs/${name}`,
    checkRunId: 11,
    workflowRunId: 22
  }
}

function details(name: string, logTail: string | null): PRCheckRunDetails {
  return {
    name,
    status: 'completed',
    conclusion: 'failure',
    url: null,
    detailsUrl: `https://github.com/acme/app/actions/runs/22/job/${name}`,
    startedAt: null,
    completedAt: null,
    title: 'Tests failed',
    summary: null,
    text: null,
    annotations: [
      {
        path: 'src/login.ts',
        startLine: 12,
        endLine: 12,
        annotationLevel: 'failure',
        title: null,
        message: 'Expected 2 to be 3',
        rawDetails: null
      }
    ],
    jobs: [
      {
        id: 5,
        name: 'unit',
        status: 'completed',
        conclusion: 'failure',
        startedAt: null,
        completedAt: null,
        url: null,
        logTail,
        steps: [
          {
            name: 'Install',
            status: 'completed',
            conclusion: 'success',
            startedAt: null,
            completedAt: null
          },
          {
            name: 'Run tests',
            status: 'completed',
            conclusion: 'failure',
            startedAt: null,
            completedAt: null
          }
        ]
      },
      {
        id: 6,
        name: 'lint',
        status: 'completed',
        conclusion: 'success',
        startedAt: null,
        completedAt: null,
        url: null,
        logTail: null,
        steps: []
      }
    ]
  }
}

function deps(overrides: Partial<PullRequestChecksDeps> = {}): PullRequestChecksDeps {
  return {
    showWorktree: async () => ({ id: 'r1::/w', repoId: 'r1', branch: 'refs/heads/feature/login' }),
    githubBlock: async () => null,
    eligibility: async () => withReview,
    checks: vi.fn(async () => [
      check('build', 'success'),
      check('test', 'failure'),
      check('deploy', 'pending'),
      check('docs', 'skipped')
    ]),
    checkDetails: vi.fn(async ({ check: failed }) => details(failed.name, 'FAIL login.test.ts\n')),
    ...overrides
  }
}

describe('pullRequest.checks', () => {
  it("lists the checks of the workspace branch's pull request without reading logs", async () => {
    const value = deps()

    const result = await readWorkspacePullRequestChecks(value, { worktree: 'id:r1::/w' })

    expect(result).toEqual({
      url: 'https://github.com/acme/app/pull/7',
      number: 7,
      branch: 'feature/login',
      checks: [
        { name: 'build', state: 'passed', url: 'https://github.com/acme/app/runs/build' },
        { name: 'test', state: 'failed', url: 'https://github.com/acme/app/runs/test' },
        { name: 'deploy', state: 'running', url: 'https://github.com/acme/app/runs/deploy' },
        { name: 'docs', state: 'skipped', url: 'https://github.com/acme/app/runs/docs' }
      ]
    })
    expect(value.checks).toHaveBeenCalledWith({ repoId: 'r1', prNumber: 7 })
    expect(value.checkDetails).not.toHaveBeenCalled()
  })

  it('adds the failed steps, annotations and log end of each failing job with --logs', async () => {
    const value = deps()

    const result = await readWorkspacePullRequestChecks(value, {
      worktree: 'id:r1::/w',
      logs: true
    })

    expect(value.checkDetails).toHaveBeenCalledTimes(1)
    expect(result.failing).toEqual([
      {
        name: 'test',
        url: 'https://github.com/acme/app/actions/runs/22/job/test',
        summary: 'Tests failed',
        annotations: ['src/login.ts:12: Expected 2 to be 3'],
        jobs: [{ name: 'unit', failedSteps: ['Run tests'], log: 'FAIL login.test.ts' }]
      }
    ])
    expect(result.failingOmitted).toBeUndefined()
  })

  it('keeps a failing check in the answer when its log cannot be read', async () => {
    const value = deps({
      checkDetails: async () => {
        throw new Error('log expired')
      }
    })

    const result = await readWorkspacePullRequestChecks(value, {
      worktree: 'id:r1::/w',
      logs: true
    })

    expect(result.failing).toEqual([
      {
        name: 'test',
        url: 'https://github.com/acme/app/runs/test',
        summary: null,
        annotations: [],
        jobs: []
      }
    ])
  })

  it('reads logs for a bounded number of failing checks and says how many it left out', async () => {
    const many = Array.from({ length: MAX_FAILING_CHECKS_WITH_LOGS + 2 }, (_, index) =>
      check(`job-${index}`, 'failure')
    )
    const value = deps({ checks: async () => many })

    const result = await readWorkspacePullRequestChecks(value, {
      worktree: 'id:r1::/w',
      logs: true
    })

    expect(value.checkDetails).toHaveBeenCalledTimes(MAX_FAILING_CHECKS_WITH_LOGS)
    expect(result.failing).toHaveLength(MAX_FAILING_CHECKS_WITH_LOGS)
    expect(result.failingOmitted).toBe(2)
  })

  it('returns only the end of a very long log', async () => {
    const value = deps({
      checkDetails: async ({ check: failed }) =>
        details(failed.name, `${'x'.repeat(40_000)}\nthe failure line`)
    })

    const result = await readWorkspacePullRequestChecks(value, {
      worktree: 'id:r1::/w',
      logs: true
    })

    const log = result.failing?.[0]?.jobs[0]?.log ?? ''
    expect(log.length).toBe(16_000)
    expect(log.endsWith('the failure line')).toBe(true)
  })

  it('says so when the branch has no pull request, and gives sign-in guidance first', async () => {
    const none = deps({ eligibility: async () => ({ ...withReview, review: null }) })
    await expect(readWorkspacePullRequestChecks(none, { worktree: 'id:r1::/w' })).rejects.toThrow(
      'feature/login has no open pull request on GitHub'
    )
    expect(none.checks).not.toHaveBeenCalled()

    const blocked = deps({ githubBlock: async () => 'Sign in with GitHub in Settings > Account.' })
    await expect(
      readWorkspacePullRequestChecks(blocked, { worktree: 'id:r1::/w' })
    ).rejects.toThrow('Sign in with GitHub in Settings > Account.')
    expect(blocked.checks).not.toHaveBeenCalled()
  })
})
