import type {
  PullRequestChecksResult,
  PullRequestCreateResult,
  PullRequestPushResult
} from '../../shared/rpc-contract/pull-request-agent-params'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'
import { resolveCurrentAgentWorkspaceSelector } from '../agent-workspace-selector'
import { readCommandBody } from '../command-body-input'
import type { CommandHandler } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'

// A push of a large branch, then GitHub's own create call.
const PUSH_TIMEOUT_MS = 180_000
const CREATE_TIMEOUT_MS = 240_000
// Up to five failing checks, each with its job logs downloaded.
const CHECKS_TIMEOUT_MS = 240_000
const MAX_BODY_CHARACTERS = 65_536

function rethrowOldRuntime(error: unknown): never {
  if (error instanceof RuntimeClientError && error.code === 'method_not_found') {
    throw new RuntimeClientError(
      'incompatible_runtime',
      `This ${FORK_PRODUCT_NAME} cannot push, open pull requests or read checks for agents yet. Update ${FORK_PRODUCT_NAME} and try again.`
    )
  }
  throw error
}

export function formatPrPush(result: PullRequestPushResult): string {
  return `Pushed ${result.branch}.`
}

export function formatPrCreate(result: PullRequestCreateResult): string {
  return result.created
    ? `Opened pull request for ${result.branch}: ${result.url}`
    : `${result.branch} already has a pull request; pushed the new commits: ${result.url}`
}

export function formatPrChecks(result: PullRequestChecksResult): string {
  const lines = [`Pull request #${result.number} for ${result.branch}: ${result.url}`]
  if (result.checks.length === 0) {
    lines.push('No checks have run on this pull request yet.')
  }
  const count = (state: string): number =>
    result.checks.filter((check) => check.state === state).length
  if (result.checks.length > 0) {
    lines.push(
      `${result.checks.length} checks: ${count('failed')} failed, ${count('running')} running, ${count('passed')} passed, ${count('skipped')} skipped.`
    )
  }
  for (const check of result.checks) {
    lines.push(`${check.state}\t${check.name}${check.url ? `\t${check.url}` : ''}`)
  }
  for (const check of result.failing ?? []) {
    lines.push('', `=== ${check.name}${check.url ? ` (${check.url})` : ''} ===`)
    if (check.summary) {
      lines.push(check.summary)
    }
    lines.push(...check.annotations)
    if (check.jobs.length === 0 && check.annotations.length === 0) {
      lines.push('GitHub has no job log for this check. Open its link for details.')
    }
    for (const job of check.jobs) {
      lines.push(`--- job: ${job.name} ---`)
      if (job.failedSteps.length > 0) {
        lines.push(`failed steps: ${job.failedSteps.join(', ')}`)
      }
      lines.push(job.log ?? 'No log is available for this job.')
    }
  }
  if (result.failingOmitted) {
    lines.push(
      '',
      `${result.failingOmitted} more failing checks are listed above without their logs.`
    )
  }
  return lines.join('\n')
}

export const PR_HANDLERS: Record<string, CommandHandler> = {
  'pr push': async (ctx) => {
    // The caller's own workspace only: there is no --worktree to aim at another one.
    const worktree = await resolveCurrentAgentWorkspaceSelector(ctx.cwd, ctx.client)
    const response = await ctx.client
      .call<PullRequestPushResult>('pullRequest.push', { worktree }, { timeoutMs: PUSH_TIMEOUT_MS })
      .catch(rethrowOldRuntime)
    printResult(response, ctx.json, formatPrPush)
  },
  'pr create': async (ctx) => {
    const title = getRequiredStringFlag(ctx.flags, 'title')
    const body = await readCommandBody(ctx.flags, ctx.cwd, {
      required: false,
      maximumCharacters: MAX_BODY_CHARACTERS,
      tooLargeCode: 'invalid_argument',
      label: 'The pull request body'
    })
    const base = getOptionalStringFlag(ctx.flags, 'base')
    const worktree = await resolveCurrentAgentWorkspaceSelector(ctx.cwd, ctx.client)
    const response = await ctx.client
      .call<PullRequestCreateResult>(
        'pullRequest.create',
        {
          worktree,
          title,
          ...(body !== undefined ? { body } : {}),
          ...(base ? { base } : {}),
          ...(ctx.flags.get('draft') === true ? { draft: true } : {})
        },
        { timeoutMs: CREATE_TIMEOUT_MS }
      )
      .catch(rethrowOldRuntime)
    printResult(response, ctx.json, formatPrCreate)
  },
  'pr checks': async (ctx) => {
    const worktree = await resolveCurrentAgentWorkspaceSelector(ctx.cwd, ctx.client)
    const response = await ctx.client
      .call<PullRequestChecksResult>(
        'pullRequest.checks',
        { worktree, ...(ctx.flags.get('logs') === true ? { logs: true } : {}) },
        { timeoutMs: CHECKS_TIMEOUT_MS }
      )
      .catch(rethrowOldRuntime)
    printResult(response, ctx.json, formatPrChecks)
  }
}
