import { defineMethod, type RpcContext } from '../../../core'
import {
  PullRequestChecksParams,
  PullRequestCreateParams,
  PullRequestPushParams
} from '../../../../../../shared/rpc-contract/pull-request-agent-params'
import {
  GithubAppNotInstalledError,
  getGithubAppAuthProvider,
  isGithubAppSignInRequired
} from '../../../../../git/command-runner/github-app-auth'
import {
  readWorkspacePullRequestChecks,
  type PullRequestChecksDeps
} from './pull-request-agent-checks'
import {
  createWorkspacePullRequest,
  pushWorkspaceBranch,
  type PullRequestAgentDeps
} from './pull-request-agent-service'

const idSelector = (worktreeId: string): string => `id:${worktreeId}`

/** Read before any git or gh runs, so the agent gets the next step instead of a failed push. */
async function githubBlock({ runtime }: RpcContext, repoId: string): Promise<string | null> {
  const provider = getGithubAppAuthProvider()
  if (!provider) {
    return null
  }
  try {
    await provider.token()
  } catch (error) {
    if (isGithubAppSignInRequired(error) && error instanceof Error) {
      return error.message
    }
    throw error
  }
  const slug = await runtime.getRepoSlug(repoId).catch(() => null)
  if (slug && (await provider.coverage(slug.owner, slug.repo)) === 'not-covered') {
    return new GithubAppNotInstalledError(slug.owner).message
  }
  return null
}

function serviceDeps(ctx: RpcContext): PullRequestAgentDeps {
  const { runtime } = ctx
  return {
    showWorktree: (selector) => runtime.showManagedWorktree(selector),
    githubBlock: (repoId) => githubBlock(ctx, repoId),
    eligibility: ({ repoId, worktreeId, branch, base }) =>
      runtime.getHostedReviewCreationEligibility({
        repoSelector: repoId,
        worktreeSelector: idSelector(worktreeId),
        branch,
        base
      }),
    push: async (worktreeId) => {
      await runtime.pushRuntimeGit(idSelector(worktreeId), true)
    },
    create: ({ repoId, worktreeId, ...input }) =>
      runtime.createHostedReview({
        repoSelector: repoId,
        worktreeSelector: idSelector(worktreeId),
        provider: 'github',
        ...input
      })
  }
}

function checksDeps(ctx: RpcContext): PullRequestChecksDeps {
  const { runtime, signal } = ctx
  const { showWorktree, githubBlock, eligibility } = serviceDeps(ctx)
  return {
    showWorktree,
    githubBlock,
    eligibility,
    // Fresh on every call: the agent asks right after a push, when a cached answer is the old run.
    checks: ({ repoId, prNumber }) =>
      runtime.getRepoPRChecks(repoId, prNumber, undefined, null, { noCache: true }),
    checkDetails: ({ repoId, check }) =>
      runtime.getRepoPRCheckDetails(
        repoId,
        {
          checkRunId: check.checkRunId,
          workflowRunId: check.workflowRunId,
          checkName: check.name,
          url: check.url,
          prRepo: null
        },
        signal
      )
  }
}

/**
 * `pr push` / `pr create` / `pr checks`: an agent's push, pull request and check reads, run by
 * main with the app sign-in.
 */
export const PULL_REQUEST_AGENT_METHODS = [
  defineMethod({
    name: 'pullRequest.push',
    permission: 'workspace',
    params: PullRequestPushParams,
    handler: async (params, ctx) => pushWorkspaceBranch(serviceDeps(ctx), params.worktree)
  }),
  defineMethod({
    name: 'pullRequest.create',
    permission: 'workspace',
    params: PullRequestCreateParams,
    handler: async (params, ctx) => createWorkspacePullRequest(serviceDeps(ctx), params)
  }),
  defineMethod({
    name: 'pullRequest.checks',
    permission: 'workspace',
    params: PullRequestChecksParams,
    handler: async (params, ctx) => readWorkspacePullRequestChecks(checksDeps(ctx), params)
  })
]
