import type { PRRefreshOutcome } from '../../../shared/github/pull-request-refresh-types'
import {
  classifyPRRefreshError,
  safePRRefreshErrorMessage
} from '../pr-refresh-error-classification'
import { classifyGhError } from '../gh-utils'
import { githubAppNotInstalledOwner } from '../../git/command-runner/github-app-auth'
// Keep real error parsing available when tests mock gh-utils.
import { extractExecError, parseRetryAfterMs } from '../../git/exec-error'
export function isNoPullRequestError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /no pull requests? found|could not find.*pull request/i.test(message)
}

export function isNotFoundGhError(err: unknown): boolean {
  // Runner diagnostics can exist only on stderr, independently of the exit message.
  return classifyGhError(extractExecError(err).stderr).type === 'not_found'
}

export function shouldStopAfterExactLookupError(err: unknown): boolean {
  return classifyGhError(extractExecError(err).stderr).type !== 'not_found'
}

export function prRefreshUpstreamError(
  err: unknown
): Extract<PRRefreshOutcome, { kind: 'upstream-error' }> {
  const errorType = classifyPRRefreshError(err)
  const outcome: Extract<PRRefreshOutcome, { kind: 'upstream-error' }> = {
    kind: 'upstream-error',
    errorType,
    // The not-installed error names the owner ("Install Revio on acme …"); its text is our own.
    message:
      errorType === 'app_not_installed' && err instanceof Error
        ? err.message
        : safePRRefreshErrorMessage(errorType),
    fetchedAt: Date.now()
  }
  const installOwner = githubAppNotInstalledOwner(err)
  if (installOwner) {
    outcome.installOwner = installOwner
  }
  // Honor server cooldowns so UI retries cannot immediately hit the same limit.
  if (errorType === 'rate_limited') {
    const retryAfterMs = parseRetryAfterMs(extractExecError(err).stderr)
    if (retryAfterMs !== null && retryAfterMs > 0) {
      const retryAt = Date.now() + retryAfterMs
      outcome.nextAutoRetryAt = retryAt
      outcome.retryDisabledUntil = retryAt
    }
  }
  return outcome
}
