import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { PROTOCOL_VERSION } from '../../protocol/daemon-protocol-version'
import { getAppEnvironment, hasAppEnvironment } from '../../../../shared/app-environment'
import { FORK_LAUNCHD_LABEL_PREFIX } from '../../../../shared/fork-identity'

/** Keep labels stable across upgrades, isolated by profile and protocol. */
export function macDaemonJobLabel(
  userDataPath: string,
  protocolVersion = PROTOCOL_VERSION,
  isPackaged = hasAppEnvironment() && getAppEnvironment().isPackaged()
): string {
  const profileKey = createHash('sha256').update(resolve(userDataPath)).digest('hex').slice(0, 16)
  // Dev keeps upstream's prefix so a running dev daemon is still found after this change.
  const prefix = isPackaged ? FORK_LAUNCHD_LABEL_PREFIX : 'com.stablyai.orca'
  return `${prefix}.terminal.${profileKey}.v${protocolVersion}`
}
