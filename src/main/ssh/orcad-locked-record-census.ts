import type { OrcadDeployOptions } from './orcad-remote-deploy'
import type { OrcadActivationRecord } from '../managed-server/activation/orcad-activation-record'
import {
  type OrcadTerminalCensus,
  UNVERIFIABLE_ORCAD_TERMINAL_CENSUS
} from '../../shared/orcad-terminal-census'

export function countedLockedRecord(
  options: OrcadDeployOptions,
  record: OrcadActivationRecord
): boolean {
  const counted = options.censusRecord
  return (
    !counted || (counted.active === record.active && counted.activatedAt === record.activatedAt)
  )
}

/** A census of another incumbent cannot authorize stopping this one. */
export function censusForLockedRecord(
  options: OrcadDeployOptions,
  record: OrcadActivationRecord
): OrcadTerminalCensus {
  return countedLockedRecord(options, record) ? options.census : UNVERIFIABLE_ORCAD_TERMINAL_CENSUS
}
