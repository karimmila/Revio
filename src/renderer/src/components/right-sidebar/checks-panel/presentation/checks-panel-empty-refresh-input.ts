import type { PRRefreshErrorType } from '../../../../../../shared/github/pull-request-refresh-types'
import type { PRRefreshState } from '@/store/github/pr-refresh-state'
import type { ChecksPanelRefreshInput } from '../checks-panel-review-state-model'

/** Keep GitHub hard errors sticky so retry state cannot briefly restore the composer. */
export function checksPanelEmptyRefreshInput(input: {
  isGitHubReviewContext: boolean
  stickyHardError: { errorType: PRRefreshErrorType } | null | undefined
  prRefreshState: PRRefreshState | undefined
}): ChecksPanelRefreshInput | undefined {
  const { stickyHardError, prRefreshState } = input
  if (!input.isGitHubReviewContext) {
    return undefined
  }
  if (stickyHardError) {
    return {
      status: 'error',
      errorType: stickyHardError.errorType,
      installOwner: prRefreshState?.installOwner
    }
  }
  return prRefreshState
    ? {
        status: prRefreshState.status,
        errorType: prRefreshState.errorType,
        skippedReason: prRefreshState.skippedReason,
        nextAutoRetryAt: prRefreshState.nextAutoRetryAt,
        retryDisabledUntil: prRefreshState.retryDisabledUntil,
        installOwner: prRefreshState.installOwner
      }
    : undefined
}
