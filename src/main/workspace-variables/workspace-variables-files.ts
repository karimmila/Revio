import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  formatDotenv,
  isValidVariableKey,
  parseDotenv,
  type WorkspaceVariable,
  type WorkspaceVariablesScope
} from '../../shared/workspace-variables/dotenv'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

/**
 * Workspace variables live as plain .env files in Orca's data folder, outside every repository, so
 * they cannot be committed and one edit reaches every worktree. Files are readable only by the
 * user. Which keys may go to a cloud sandbox is kept beside them in cloud.json, and, under
 * `environment`, which of those the person also let into the sandbox's /etc/environment.
 */
type KeysByScope = { global: string[]; repos: Record<string, string[]> }
type CloudFlags = KeysByScope & { environment: KeysByScope }

let rootDir: () => string = () => {
  throw new Error('Workspace variables root not configured')
}

export function setWorkspaceVariablesRoot(next: () => string): void {
  rootDir = next
}

function safeRepoId(repoId: string): string {
  return repoId.replace(/[^A-Za-z0-9_-]/g, '_')
}

export function workspaceVariablesFile(scope: WorkspaceVariablesScope): string {
  return scope.kind === 'global'
    ? join(rootDir(), 'global.env')
    : join(rootDir(), 'repos', `${safeRepoId(scope.repoId)}.env`)
}

function cloudFile(): string {
  return join(rootDir(), 'cloud.json')
}

function writePrivate(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true, mode: 0o700 })
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, content, { mode: 0o600 })
  chmodSync(temp, 0o600)
  renameSync(temp, path)
}

function validKeys(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((key): key is string => typeof key === 'string' && isValidVariableKey(key))
    : []
}

function keysByScope(parsed: unknown): KeysByScope {
  if (!parsed || typeof parsed !== 'object') {
    return { global: [], repos: {} }
  }
  const repos = 'repos' in parsed ? parsed.repos : undefined
  return {
    global: validKeys('global' in parsed ? parsed.global : undefined),
    repos:
      repos && typeof repos === 'object'
        ? Object.fromEntries(Object.entries(repos).map(([id, keys]) => [id, validKeys(keys)]))
        : {}
  }
}

function readCloudFlags(): CloudFlags {
  try {
    const parsed: unknown = JSON.parse(readFileSync(cloudFile(), 'utf8'))
    if (parsed && typeof parsed === 'object') {
      return {
        ...keysByScope(parsed),
        environment: keysByScope('environment' in parsed ? parsed.environment : undefined)
      }
    }
  } catch {
    // No flags yet: nothing goes to the cloud.
  }
  return { global: [], repos: {}, environment: { global: [], repos: {} } }
}

function cloudKeys(flags: KeysByScope, scope: WorkspaceVariablesScope): string[] {
  return scope.kind === 'global' ? flags.global : (flags.repos[scope.repoId] ?? [])
}

/** The cloud keys the person also let into a repository's sandbox /etc/environment. */
export function readCloudEnvironmentKeys(repoId: string): Set<string> {
  const flags = readCloudFlags()
  const keys = new Set<string>()
  for (const scope of [{ kind: 'global' as const }, { kind: 'repo' as const, repoId }]) {
    const sent = new Set(cloudKeys(flags, scope))
    for (const key of cloudKeys(flags.environment, scope)) {
      if (sent.has(key)) {
        keys.add(key)
      }
    }
  }
  return keys
}

export function readScopeValues(scope: WorkspaceVariablesScope): Record<string, string> {
  const file = workspaceVariablesFile(scope)
  return existsSync(file) ? parseDotenv(readFileSync(file, 'utf8')) : {}
}

/**
 * The values a repository's cloud sandbox may receive: only keys marked "Send to cloud", global
 * first and the repository's on top, the same order as on this Mac.
 */
export function readCloudValues(repoId: string): Record<string, string> {
  const flags = readCloudFlags()
  const values: Record<string, string> = {}
  for (const scope of [{ kind: 'global' as const }, { kind: 'repo' as const, repoId }]) {
    const all = readScopeValues(scope)
    for (const key of cloudKeys(flags, scope)) {
      if (key in all) {
        values[key] = all[key] ?? ''
      }
    }
  }
  return values
}

export function readWorkspaceVariables(scope: WorkspaceVariablesScope): WorkspaceVariable[] {
  const flags = readCloudFlags()
  const cloud = new Set(cloudKeys(flags, scope))
  const environment = new Set(cloudKeys(flags.environment, scope))
  return Object.entries(readScopeValues(scope)).map(([key, value]) => ({
    key,
    value,
    sendToCloud: cloud.has(key),
    cloudEnvironment: cloud.has(key) && environment.has(key)
  }))
}

export function writeWorkspaceVariables(
  scope: WorkspaceVariablesScope,
  variables: readonly WorkspaceVariable[]
): void {
  const values: Record<string, string> = {}
  const cloud: string[] = []
  const environment: string[] = []
  for (const variable of variables) {
    if (!isValidVariableKey(variable.key)) {
      throw new Error(`"${variable.key}" is not a valid variable name`)
    }
    values[variable.key] = variable.value
    if (variable.sendToCloud) {
      cloud.push(variable.key)
      if (variable.cloudEnvironment) {
        environment.push(variable.key)
      }
    }
  }
  const header =
    `# ${FORK_PRODUCT_NAME} workspace variables. One KEY=value per line; ${FORK_PRODUCT_NAME} adds them to every terminal,\n` +
    '# chat and script it starts. Edit here or in Settings > Environment.\n'
  writePrivate(workspaceVariablesFile(scope), `${header}${formatDotenv(values)}\n`)
  const flags = readCloudFlags()
  if (scope.kind === 'global') {
    flags.global = cloud
    flags.environment.global = environment
  } else {
    flags.repos[scope.repoId] = cloud
    flags.environment.repos[scope.repoId] = environment
  }
  writePrivate(cloudFile(), `${JSON.stringify(flags, null, 2)}\n`)
}
