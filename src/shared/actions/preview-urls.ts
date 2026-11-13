import { IMPORTED_SCRIPT_ENV } from '../import-source-app'
import { FORK_SCRIPT_ENV } from '../workspace-script-env'

const PORT_NAMES = `(?:${FORK_SCRIPT_ENV.port}|ORCA_PORT|${IMPORTED_SCRIPT_ENV.port})`
const PORT_PLUS_OFFSET = new RegExp(`\\$\\(\\(\\s*${PORT_NAMES}\\s*\\+\\s*(\\d)\\s*\\)\\)`, 'g')
const PORT = new RegExp(`\\$\\{?${PORT_NAMES}\\}?`, 'g')

/**
 * Preview URLs: a repository's URLs for the terminal panel's Open button, written with the
 * workspace port, written with this app's port variable (FORK_SCRIPT_ENV.port), alone or as
 * `$((NAME + 1))`. `ORCA_PORT` and the imported scripts' port name work too.
 */
export function expandPreviewUrl(template: string, port: number): string {
  return template
    .replace(PORT_PLUS_OFFSET, (_match, offset: string) => String(port + Number(offset)))
    .replace(PORT, String(port))
    .trim()
}

/** Keeps non-empty lines, at most ten. */
export function normalizePreviewUrls(lines: readonly string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10)
}
