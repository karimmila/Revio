import type { KnownRuntimeEnvironment } from '../../shared/remote-runtime/host-catalog/runtime-environments'
import type { OrcadManagedRollbackResult } from '../../shared/orcad-managed-runtime'
import { findIncompleteManagedOrcadMigration } from '../managed-server/lifecycle/orcad-managed-migration-status'
import { latestOrcadMigrationInto } from './orcad-migration-rollback-mark'

/** A post-activation migration is absent from the rollback snapshot; restoring it would discard imported state. */
export function migrationRollbackRefusal(
  userDataPath: string,
  environment: KnownRuntimeEnvironment,
  activatedAt: string | null
): OrcadManagedRollbackResult | null {
  if (findIncompleteManagedOrcadMigration(userDataPath, environment.id)) {
    return {
      outcome: 'refused',
      code: 'orcad_rollback_migration_in_progress',
      reason: 'A migration into this server is still running. Finish it before rolling back.'
    }
  }
  const migratedAt = latestOrcadMigrationInto(userDataPath, environment)
  if (migratedAt && (activatedAt === null || Date.parse(activatedAt) < Date.parse(migratedAt))) {
    return {
      outcome: 'refused',
      code: 'orcad_rollback_crosses_migration',
      reason:
        "The previous version's state predates the projects migrated onto this server; " +
        'rolling back would lose them. Deploy forward instead.'
    }
  }
  return null
}
