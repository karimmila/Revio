import { readRecord, readString } from '../../app-server/codex-item-field-readers'

/** Codex's `permissions` field on item/permissions/requestApproval, kept as sent so a grant echoes it. */
export function readCodexRequestedPermissions(params: unknown): Record<string, unknown> | null {
  const permissions = readRecord(params).permissions
  return typeof permissions === 'object' && permissions !== null && !Array.isArray(permissions)
    ? readRecord(permissions)
    : null
}

function readPaths(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((path): path is string => typeof path === 'string' && path.length > 0)
    : []
}

function entryPath(entry: Record<string, unknown>): string | null {
  const path = entry.path
  if (typeof path === 'string') {
    return path
  }
  const record = readRecord(path)
  return readString(record, 'path') ?? readString(record, 'pattern') ?? readString(record, 'value')
}

function entryLine(entry: Record<string, unknown>): string | null {
  const path = entryPath(entry)
  if (!path) {
    return null
  }
  const access = entry.access === 'deny' ? 'Deny' : entry.access === 'write' ? 'Write' : 'Read'
  return `${access} ${path}`
}

/**
 * One line per requested permission, as the workspace layout lists them: network, then reads, then
 * writes.
 */
export function codexPermissionLines(permissions: Record<string, unknown> | null): string[] {
  if (!permissions) {
    return []
  }
  const network = readRecord(permissions.network)
  const fileSystem = readRecord(permissions.fileSystem ?? permissions.filesystem)
  const entries = Array.isArray(fileSystem.entries) ? fileSystem.entries : []
  return [
    ...(network.enabled === true ? ['Network access'] : []),
    ...readPaths(fileSystem.read).map((path) => `Read ${path}`),
    ...readPaths(fileSystem.write).map((path) => `Write ${path}`),
    ...entries.flatMap((entry) => {
      const line = entryLine(readRecord(entry))
      return line ? [line] : []
    })
  ]
}

/** The reply that grants exactly what was asked, for this turn only. */
export function codexPermissionsGrantReply(
  requested: Record<string, unknown>
): Record<string, unknown> {
  return { permissions: requested, scope: 'turn' }
}

/** The reply Orca always sent before these requests became prompts: nothing granted. */
export function codexPermissionsDeclineReply(): Record<string, unknown> {
  return { permissions: {}, scope: 'turn', strictAutoReview: true }
}
