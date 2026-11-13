import { GITHUB_EXACT_OPERATION_UNSUPPORTED } from '../../../shared/github/work-item-target'
import { FORK_PRODUCT_NAME } from '../../../shared/fork-identity'
import { failure } from './mobile-desktop-relay-link'

/** The reply for a relayed request whose pre-send preparation or server verification failed. */
export function relayedPreSendFailure(requestId: string, method: string, error: unknown): string {
  return failure(
    requestId,
    method === 'browser.tabCreate' ||
      method === 'status.get' ||
      (error instanceof Error && error.message === GITHUB_EXACT_OPERATION_UNSUPPORTED)
      ? 'remote_runtime_unavailable'
      : 'runtime_source_mismatch',
    error instanceof Error
      ? error.message
      : `Unable to confirm the executing ${FORK_PRODUCT_NAME} server.`
  )
}
