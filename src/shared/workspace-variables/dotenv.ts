/** One variable in a workspace variables scope. */
export type WorkspaceVariable = {
  key: string
  value: string
  /** Off by default: only variables marked here reach a cloud sandbox. */
  sendToCloud: boolean
  /**
   * Off by default: a cloud value reaches only the sandbox's setup, wake and Run scripts. On, it
   * also goes to /etc/environment, so every shell and agent in the sandbox inherits it.
   */
  cloudEnvironment?: boolean
}

/** Global applies to every repository; a repository scope overrides it key by key. */
export type WorkspaceVariablesScope = { kind: 'global' } | { kind: 'repo'; repoId: string }

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Variables Orca never sets, whatever a scope holds: the shell's own identity and paths, and Orca's
 * internal channel. Setting them would break the terminal rather than configure the project.
 */
const RESERVED = new Set([
  'PATH',
  'HOME',
  'SHELL',
  'USER',
  'LOGNAME',
  'TERM',
  'PWD',
  'OLDPWD',
  'TMPDIR',
  'LANG',
  'SSH_AUTH_SOCK',
  'NODE_OPTIONS'
])

export function isValidVariableKey(key: string): boolean {
  return KEY_PATTERN.test(key)
}

export function isReservedVariableKey(key: string): boolean {
  return RESERVED.has(key) || key.startsWith('LC_') || key.startsWith('ORCA_')
}

function unquote(value: string): string {
  if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) {
    const inner = value.slice(1, -1)
    return value[0] === '"'
      ? inner.replace(/\\(.)/g, (_, c: string) => (c === 'n' ? '\n' : c))
      : inner
  }
  // An unquoted value ends at an inline comment, as dotenv reads it.
  const hash = value.search(/\s#/)
  return (hash === -1 ? value : value.slice(0, hash)).trim()
}

/** Reads KEY=value lines in .env format: comments, blanks and `export ` prefixes are skipped. */
export function parseDotenv(text: string): Record<string, string> {
  const variables: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^export\s+/, '')
    const equals = line.indexOf('=')
    if (!line || line.startsWith('#') || equals <= 0) {
      continue
    }
    const key = line.slice(0, equals).trim()
    if (isValidVariableKey(key)) {
      variables[key] = unquote(line.slice(equals + 1).trim())
    }
  }
  return variables
}

function quote(value: string): string {
  return /^[A-Za-z0-9_./:@%+=,-]*$/.test(value)
    ? value
    : `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
}

/** Writes variables back in .env format, one per line, quoting values that need it. */
export function formatDotenv(variables: Record<string, string>): string {
  return Object.entries(variables)
    .map(([key, value]) => `${key}=${quote(value)}`)
    .join('\n')
}
