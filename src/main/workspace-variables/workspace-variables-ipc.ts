import { ipcMain, shell } from 'electron'
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  isValidVariableKey,
  parseDotenv,
  type WorkspaceVariable,
  type WorkspaceVariablesScope
} from '../../shared/workspace-variables/dotenv'
import type {
  WorktreeEnvKeyReport,
  WorktreeEnvScanResult
} from '../../shared/workspace-variables/worktree-env-scan'
import {
  readWorkspaceVariables,
  workspaceVariablesFile,
  writeWorkspaceVariables
} from './workspace-variables-files'

type RepoFolders = (repoId: string) => { label: string; path: string }[]

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  '.venv',
  'vendor'
])
const MAX_DEPTH = 4
const MAX_FILE_BYTES = 256 * 1024

function parseScope(value: unknown): WorkspaceVariablesScope {
  if (value && typeof value === 'object' && 'kind' in value) {
    if (value.kind === 'global') {
      return { kind: 'global' }
    }
    if (value.kind === 'repo' && 'repoId' in value && typeof value.repoId === 'string') {
      return { kind: 'repo', repoId: value.repoId }
    }
  }
  throw new Error('Unknown variables scope')
}

function parseVariables(value: unknown): WorkspaceVariable[] {
  if (!Array.isArray(value)) {
    throw new Error('Variables must be a list')
  }
  return value.map((item: unknown) => {
    if (
      !item ||
      typeof item !== 'object' ||
      !('key' in item) ||
      !('value' in item) ||
      typeof item.key !== 'string' ||
      typeof item.value !== 'string' ||
      !isValidVariableKey(item.key)
    ) {
      throw new Error('Each variable needs a valid name and a text value')
    }
    const sendToCloud = 'sendToCloud' in item && item.sendToCloud === true
    const cloudEnvironment =
      sendToCloud && 'cloudEnvironment' in item && item.cloudEnvironment === true
    return { key: item.key, value: item.value, sendToCloud, cloudEnvironment }
  })
}

/** `.env` files in a checkout (not examples), skipping dependency and build folders. */
function findEnvFiles(root: string, dir = root, depth = 0): string[] {
  if (depth > MAX_DEPTH) {
    return []
  }
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  const found: string[] = []
  for (const name of names) {
    const path = join(dir, name)
    let isDir = false
    try {
      // A repository's symlinks could point anywhere on the Mac; the scan never follows them.
      const entry = lstatSync(path)
      if (entry.isSymbolicLink()) {
        continue
      }
      isDir = entry.isDirectory()
    } catch {
      continue
    }
    if (isDir) {
      if (!SKIP_DIRS.has(name) && !name.startsWith('.')) {
        found.push(...findEnvFiles(root, path, depth + 1))
      }
    } else if (/^\.env(\.local)?$/.test(name)) {
      found.push(path)
    }
  }
  return found
}

/**
 * Reads every worktree's .env files for one repository and groups values by key, so the user can
 * see which keys agree everywhere (safe to centralize) and which differ (between worktrees or
 * services). Read-only: no file is changed.
 */
function scanWorktreeEnvFiles(folders: { label: string; path: string }[]): WorktreeEnvScanResult {
  const byKey = new Map<string, Map<string, string[]>>()
  let files = 0
  for (const folder of folders) {
    if (!existsSync(folder.path)) {
      continue
    }
    for (const file of findEnvFiles(folder.path)) {
      try {
        if (statSync(file).size > MAX_FILE_BYTES) {
          continue
        }
        files += 1
        const where = `${folder.label}/${relative(folder.path, file)}`
        for (const [key, value] of Object.entries(parseDotenv(readFileSync(file, 'utf8')))) {
          const values = byKey.get(key) ?? new Map<string, string[]>()
          values.set(value, [...(values.get(value) ?? []), where])
          byKey.set(key, values)
        }
      } catch {
        // An unreadable file is left out of the report.
      }
    }
  }
  const keys: WorktreeEnvKeyReport[] = [...byKey.entries()]
    .map(([key, values]) => ({
      key,
      values: [...values.entries()].map(([value, locations]) => ({ value, locations }))
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
  return { folders: folders.length, files, keys }
}

export function registerWorkspaceVariablesHandlers(repoFolders: RepoFolders): void {
  ipcMain.handle('workspaceVariables:read', (_event, scope: unknown) =>
    readWorkspaceVariables(parseScope(scope))
  )
  ipcMain.handle('workspaceVariables:write', (_event, scope: unknown, variables: unknown) => {
    writeWorkspaceVariables(parseScope(scope), parseVariables(variables))
  })
  ipcMain.handle('workspaceVariables:openFile', async (_event, scope: unknown) => {
    const parsed = parseScope(scope)
    const file = workspaceVariablesFile(parsed)
    if (!existsSync(file)) {
      writeWorkspaceVariables(parsed, readWorkspaceVariables(parsed))
    }
    const error = await shell.openPath(file)
    if (error) {
      throw new Error(error)
    }
  })
  ipcMain.handle('workspaceVariables:scanWorktrees', (_event, repoId: unknown) => {
    if (typeof repoId !== 'string') {
      throw new Error('Unknown repository')
    }
    return scanWorktreeEnvFiles(repoFolders(repoId))
  })
}
