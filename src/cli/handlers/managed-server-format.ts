import type { OrcadManagedRuntimeStatus } from '../../shared/orcad-managed-runtime'
import { FORK_PRODUCT_NAME, FORK_CLI_COMMAND_NAME } from '../../shared/fork-identity'

function count(value: number | null): string {
  return value === null ? 'unverifiable' : String(value)
}

export function formatManagedServerStatus(status: OrcadManagedRuntimeStatus): string {
  const lines = [
    `Active version: ${status.activeVersion ?? 'none'}${status.activeAppVersion ? ` (${FORK_PRODUCT_NAME} ${status.activeAppVersion})` : ''}`,
    `Previous version: ${status.previousVersion ?? 'none'}${status.rollbackAvailable ? ' (rollback available)' : ''}`,
    `Live terminals: ${count(status.terminals.liveSessions)}`
  ]
  if (status.recovery) {
    lines.push(
      `Interrupted ${status.recovery.operation} of ${status.recovery.version} (${status.recovery.phase}); run \`${FORK_CLI_COMMAND_NAME} environment recover\`.`
    )
  }
  if (status.migration) {
    lines.push(`Migration into this server: ${status.migration.phase}`)
  }
  if (status.deferredUpdate) {
    lines.push(
      `Deferred update to ${status.deferredUpdate.candidateVersion}: ${status.deferredUpdate.reason}`
    )
  }
  if (status.availableUpdate) {
    lines.push(
      `Update available: ${status.availableUpdate}; run \`${FORK_CLI_COMMAND_NAME} environment update --environment ${status.environmentId}\`.`
    )
  }
  return lines.join('\n')
}
