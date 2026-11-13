/** Reject activation over state a newer host build may already have migrated. */
import { compareAppVersions } from '../../shared/app-version'
import type { OrcadActivationRecord } from '../managed-server/activation/orcad-activation-record'

export type OrcadHostVersionRefusal = 'host-newer'

/*
 * This app took over the upstream version line (1.4.x) for its early builds, then started its own
 * line at 0.1.0. A host or cloud sandbox last run by a 1.4.x build was therefore run by an OLDER
 * build of this app, though its number is higher. Without this, 0.1.0 refuses to start the server
 * on every sandbox and restore point those builds made ("newer than this app").
 * Remove before this app's own line reaches 1.0.0.
 */
const PRE_RENUMBERING_LINE = /^v?1\.4\.\d+(?:[-+].*)?$/

function isOwnLine(version: string): boolean {
  return compareAppVersions(version, '1.0.0') < 0
}

/** Negative when the host was last run by an older build than `appVersion`, positive when newer. */
export function compareHostAppVersion(hostAppVersion: string, appVersion: string): number {
  if (PRE_RENUMBERING_LINE.test(hostAppVersion.trim()) && isOwnLine(appVersion)) {
    return -1
  }
  if (PRE_RENUMBERING_LINE.test(appVersion.trim()) && isOwnLine(hostAppVersion)) {
    return 1
  }
  return compareAppVersions(hostAppVersion, appVersion)
}

export function refuseOrcadHostDowngrade(
  record: OrcadActivationRecord,
  candidateVersion: string,
  appVersion: string
): OrcadHostVersionRefusal | null {
  // Restarting the stopped build cannot downgrade state.
  if (record.active === null && record.previous === candidateVersion) {
    return null
  }
  // Older Stop records omit app version; refuse only proven newer hosts or they would be stranded.
  if (!record.activeAppVersion) {
    return null
  }
  return compareHostAppVersion(record.activeAppVersion, appVersion) > 0 ? 'host-newer' : null
}
