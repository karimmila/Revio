import type {
  CreateHostedReviewResult,
  HostedReviewCreationEligibility
} from '../../../../../../shared/source-control/hosted-review/hosted-review-contracts'
import type {
  PullRequestCreateResult,
  PullRequestPushResult
} from '../../../../../../shared/rpc-contract/pull-request-agent-params'
import { FORK_PRODUCT_NAME } from '../../../../../../shared/fork-identity'
import { InvalidArgumentError } from '../../../core'

/*
 * `pr push` and `pr create` for an agent in a local workspace. The agent has no GitHub credential
 * of its own: it asks, and main pushes the workspace's branch and opens the pull request with the
 * app's sign-in. Nothing here takes a remote, a refspec or another repository, and no token is
 * returned or logged.
 */
export type PullRequestAgentDeps = {
  /** The workspace the selector names: its id, repository and checked-out branch. */
  showWorktree: (selector: string) => Promise<{ id: string; repoId: string; branch: string }>
  /** Sign-in or "install the app on <owner>" guidance when GitHub is not usable; null when it is. */
  githubBlock: (repoId: string) => Promise<string | null>
  eligibility: (args: {
    repoId: string
    worktreeId: string
    branch: string
    base: string | null
  }) => Promise<HostedReviewCreationEligibility>
  push: (worktreeId: string) => Promise<void>
  create: (args: {
    repoId: string
    worktreeId: string
    base: string
    head: string
    title: string
    body: string | undefined
    draft: boolean
  }) => Promise<CreateHostedReviewResult>
}

export type PullRequestAgentTarget = { worktreeId: string; repoId: string; branch: string }
type Target = PullRequestAgentTarget

export async function resolvePullRequestAgentTarget(
  deps: Pick<PullRequestAgentDeps, 'showWorktree' | 'githubBlock'>,
  selector: string
): Promise<Target> {
  const worktree = await deps.showWorktree(selector)
  const branch = worktree.branch.replace(/^refs\/heads\//, '').trim()
  if (!branch || branch === 'HEAD') {
    throw new InvalidArgumentError(
      'This workspace is not on a branch. Check out a branch, then try again.'
    )
  }
  const block = await deps.githubBlock(worktree.repoId)
  if (block) {
    throw new InvalidArgumentError(block)
  }
  return { worktreeId: worktree.id, repoId: worktree.repoId, branch }
}

function stripBaseRef(base: string): string {
  return base.replace(/^refs\/(heads|remotes\/[^/]+)\//, '').replace(/^origin\//, '')
}

function existing(
  review: { url: string; number?: number },
  branch: string
): PullRequestCreateResult {
  return { url: review.url, number: review.number ?? null, branch, created: false }
}

export async function pushWorkspaceBranch(
  deps: PullRequestAgentDeps,
  selector: string
): Promise<PullRequestPushResult> {
  const target = await resolvePullRequestAgentTarget(deps, selector)
  await deps.push(target.worktreeId)
  return { branch: target.branch }
}

export async function createWorkspacePullRequest(
  deps: PullRequestAgentDeps,
  params: { worktree: string; title: string; body?: string; base?: string; draft?: boolean }
): Promise<PullRequestCreateResult> {
  const target = await resolvePullRequestAgentTarget(deps, params.worktree)
  const eligibility = await deps.eligibility({
    repoId: target.repoId,
    worktreeId: target.worktreeId,
    branch: target.branch,
    base: params.base ?? null
  })
  if (eligibility.provider !== 'github') {
    throw new InvalidArgumentError(
      `${FORK_PRODUCT_NAME} opens pull requests for GitHub repositories only.`
    )
  }
  const base = stripBaseRef(params.base ?? eligibility.defaultBaseRef ?? '')
  if (!base) {
    throw new InvalidArgumentError('Could not find the base branch. Pass --base <branch>.')
  }
  if (base.toLowerCase() === target.branch.toLowerCase()) {
    throw new InvalidArgumentError(
      `This workspace is on ${target.branch}, the base branch. Work on another branch to open a pull request.`
    )
  }
  // Always push first: a new pull request needs the branch on GitHub, an open one takes the commits.
  await deps.push(target.worktreeId)
  if (eligibility.review) {
    return existing(eligibility.review, target.branch)
  }
  const result = await deps.create({
    repoId: target.repoId,
    worktreeId: target.worktreeId,
    base,
    head: target.branch,
    title: params.title,
    body: params.body,
    draft: params.draft === true
  })
  if (result.ok) {
    return { url: result.url, number: result.number, branch: target.branch, created: true }
  }
  if (result.existingReview) {
    return existing(result.existingReview, target.branch)
  }
  throw new InvalidArgumentError(result.error)
}
