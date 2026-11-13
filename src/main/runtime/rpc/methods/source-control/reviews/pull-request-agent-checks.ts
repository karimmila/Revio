import type {
  PRCheckDetail,
  PRCheckJob,
  PRCheckRunDetails
} from '../../../../../../shared/github/check-types'
import type {
  PullRequestCheckState,
  PullRequestChecksResult,
  PullRequestFailingCheck
} from '../../../../../../shared/rpc-contract/pull-request-agent-params'
import { InvalidArgumentError } from '../../../core'
import {
  resolvePullRequestAgentTarget,
  type PullRequestAgentDeps
} from './pull-request-agent-service'

/*
 * `pr checks` for an agent in a local workspace: the checks of the pull request for the
 * workspace's own branch and, on request, the end of each failing job's log. Main reads them with
 * the app's GitHub sign-in, so the agent needs no `gh` login and never sees a token.
 */
export type PullRequestChecksDeps = Pick<
  PullRequestAgentDeps,
  'showWorktree' | 'githubBlock' | 'eligibility'
> & {
  checks: (args: { repoId: string; prNumber: number }) => Promise<PRCheckDetail[]>
  checkDetails: (args: {
    repoId: string
    check: PRCheckDetail
  }) => Promise<PRCheckRunDetails | null>
}

/** Logs are read one check at a time; past this an agent reads the rest after fixing the first. */
export const MAX_FAILING_CHECKS_WITH_LOGS = 5
const MAX_LOG_CHARACTERS = 16_000
const MAX_ANNOTATIONS = 20

const FAILED = new Set(['failure', 'failed', 'cancelled', 'timed_out', 'action_required'])

export function pullRequestCheckState(check: PRCheckDetail): PullRequestCheckState {
  if (check.status !== 'completed' || check.conclusion === 'pending' || !check.conclusion) {
    return 'running'
  }
  if (FAILED.has(check.conclusion)) {
    return 'failed'
  }
  return check.conclusion === 'skipped' ? 'skipped' : 'passed'
}

function logEnd(job: PRCheckJob): string | null {
  const log = job.logTail?.trimEnd()
  if (!log) {
    return null
  }
  // The failure is at the end, so an over-long excerpt loses its start.
  return log.length > MAX_LOG_CHARACTERS ? log.slice(-MAX_LOG_CHARACTERS) : log
}

function failingCheck(
  check: PRCheckDetail,
  details: PRCheckRunDetails | null
): PullRequestFailingCheck {
  const jobs = (details?.jobs ?? []).filter(
    (job) => FAILED.has(job.conclusion ?? '') || job.logTail
  )
  return {
    name: check.name,
    url: details?.detailsUrl ?? details?.url ?? check.url,
    summary: details?.title ?? details?.summary ?? null,
    annotations: (details?.annotations ?? []).slice(0, MAX_ANNOTATIONS).map((annotation) => {
      const where = annotation.path
        ? `${annotation.path}${annotation.startLine ? `:${annotation.startLine}` : ''}: `
        : ''
      return `${where}${annotation.message}`
    }),
    jobs: jobs.map((job) => ({
      name: job.name,
      failedSteps: job.steps
        .filter((step) => FAILED.has(step.conclusion ?? ''))
        .map((step) => step.name),
      log: logEnd(job)
    }))
  }
}

export async function readWorkspacePullRequestChecks(
  deps: PullRequestChecksDeps,
  params: { worktree: string; logs?: boolean }
): Promise<PullRequestChecksResult> {
  const target = await resolvePullRequestAgentTarget(deps, params.worktree)
  const eligibility = await deps.eligibility({
    repoId: target.repoId,
    worktreeId: target.worktreeId,
    branch: target.branch,
    base: null
  })
  const review = eligibility.review
  if (eligibility.provider !== 'github' || !review || review.number === undefined) {
    throw new InvalidArgumentError(
      `${target.branch} has no open pull request on GitHub, so there are no checks to read.`
    )
  }
  const checks = await deps.checks({ repoId: target.repoId, prNumber: review.number })
  const result: PullRequestChecksResult = {
    url: review.url,
    number: review.number,
    branch: target.branch,
    checks: checks.map((check) => ({
      name: check.name,
      state: pullRequestCheckState(check),
      url: check.url
    }))
  }
  if (params.logs !== true) {
    return result
  }
  const failed = checks.filter((check) => pullRequestCheckState(check) === 'failed')
  const failing: PullRequestFailingCheck[] = []
  for (const check of failed.slice(0, MAX_FAILING_CHECKS_WITH_LOGS)) {
    // One unreadable log must not hide the others: the check is still listed, without a log.
    const details = await deps.checkDetails({ repoId: target.repoId, check }).catch(() => null)
    failing.push(failingCheck(check, details))
  }
  return {
    ...result,
    failing,
    ...(failed.length > failing.length ? { failingOmitted: failed.length - failing.length } : {})
  }
}
