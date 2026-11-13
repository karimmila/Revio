import { RuntimeClientError } from './types'
import { FORK_PRODUCT_NAME, FORK_CLI_COMMAND_NAME } from '../../shared/fork-identity'

// Errno determines denial; CODEX_SANDBOX only selects wording.
export function runtimeAccessDeniedError(socketError: Error): RuntimeClientError | null {
  const systemCode = 'code' in socketError ? socketError.code : undefined
  if (systemCode !== 'EPERM' && systemCode !== 'EACCES') {
    return null
  }
  const codexSandbox = Boolean(process.env.CODEX_SANDBOX)
  const message = codexSandbox
    ? `The Codex sandbox blocked this command from connecting to ${FORK_PRODUCT_NAME} (${systemCode}). ${FORK_PRODUCT_NAME} may be running normally.`
    : `Permission denied connecting to ${FORK_PRODUCT_NAME} (${systemCode}). ${FORK_PRODUCT_NAME} may be running normally; this command's sandbox or OS permissions block the connection.`
  const retryStep = codexSandbox
    ? "Retry through Codex's existing escalation when the session permits it; otherwise run the same command from a terminal outside the sandbox."
    : `Re-run this command outside its sandbox, or as a user allowed to reach the ${FORK_PRODUCT_NAME} runtime.`
  return new RuntimeClientError('runtime_access_denied', message, {
    systemCode,
    nextSteps: [
      retryStep,
      `Do not restart ${FORK_PRODUCT_NAME} or run '${FORK_CLI_COMMAND_NAME} open'; a restart cannot grant this command access.`
    ]
  })
}
