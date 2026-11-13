import { BrowserWindow } from 'electron'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseToml } from 'smol-toml'
import { IMPORT_SOURCE_REPO_SETTINGS_FILES } from '../../shared/import-source-app'
import { translateMain } from '../i18n/main-i18n'
import { getDefaultRepoHookSettings } from '../../shared/constants'
import { writeSecureFile } from '../../shared/secure-file'
import type { Repo } from '../../shared/repo-types'
import type { Store } from '../persistence/loading-store/store'
import { personalFile, readPersonal } from '../actions/repo-actions-store'
import { git } from './workspace-import-git'

export type ImportSourceScripts = {
  setup: string | null
  run: string | null
  runMode: 'concurrent' | 'nonconcurrent' | null
  /** The settings file the scripts were read from, relative to the repository root. */
  file: string
}

/** Names the exact script text the person was shown, so only that text is stored. */
export function importSourceScriptsHash(
  scripts: Pick<ImportSourceScripts, 'setup' | 'run'>
): string {
  return createHash('sha256')
    .update(JSON.stringify([scripts.setup, scripts.run]))
    .digest('hex')
}

/**
 * True when the scripts came with the repository's code: git tracks the settings file. Such a
 * script is not the person's own, so it needs their approval like any repository setup script.
 * When git cannot say, the answer is yes.
 */
export async function isRepositoryProvidedScripts(
  repoRootPath: string,
  scripts: Pick<ImportSourceScripts, 'file'>
): Promise<boolean> {
  try {
    const listed = await git(repoRootPath, ['ls-files', '--full-name', '--', scripts.file])
    return listed.trim() !== ''
  } catch {
    return true
  }
}

/**
 * The scripts this import may store for a repository: the person's own always, the repository's
 * only when the person approved that exact text.
 */
export async function approvedImportSourceScripts(
  repoRootPath: string | null,
  approvedHashes: ReadonlySet<string>
): Promise<ImportSourceScripts | null> {
  const scripts = await readImportSourceScripts(repoRootPath)
  if (!scripts || !repoRootPath) {
    return null
  }
  if (!(await isRepositoryProvidedScripts(repoRootPath, scripts))) {
    return scripts
  }
  return approvedHashes.has(importSourceScriptsHash(scripts)) ? scripts : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
    ? Object.fromEntries(Object.entries(value))
    : null
}

function scriptText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * The first settings file that names any script wins, as the source app reads its local file first.
 * The repository can be in a folder macOS guards (Desktop, Documents), so the read never blocks
 * the main thread, and it only runs once the person has asked for the import.
 */
export async function readImportSourceScripts(
  repoRootPath: string | null
): Promise<ImportSourceScripts | null> {
  if (!repoRootPath) {
    return null
  }
  for (const file of IMPORT_SOURCE_REPO_SETTINGS_FILES) {
    try {
      const parsed = parseToml(await readFile(join(repoRootPath, file), 'utf8'))
      const record = asRecord(parsed.scripts)
      if (!record) {
        continue
      }
      const setup = scriptText(record.setup)
      const run = scriptText(record.run)
      if (setup || run) {
        const mode = record.run_mode
        return {
          setup,
          run,
          runMode: mode === 'nonconcurrent' || mode === 'concurrent' ? mode : null,
          file
        }
      }
    } catch {
      continue
    }
  }
  return null
}

/**
 * The setup script becomes the project's setup script and the run script a personal action. A
 * project that already has a setup script or the same action keeps what it has. Both run with the
 * source app's variable names set, so the scripts work unchanged.
 */
export function applyImportSourceScripts(
  store: Store,
  repo: Repo,
  scripts: ImportSourceScripts
): void {
  if (scripts.setup && !repo.hookSettings?.scripts.setup.trim()) {
    const defaults = getDefaultRepoHookSettings()
    store.updateRepo(repo, {
      hookSettings: {
        ...defaults,
        ...repo.hookSettings,
        commandSourcePolicy: 'local-only',
        scripts: { ...defaults.scripts, ...repo.hookSettings?.scripts, setup: scripts.setup }
      }
    })
  }
  if (!scripts.run) {
    return
  }
  const personal = readPersonal(repo.id)
  if (personal.actions.some((action) => action.script === scripts.run)) {
    return
  }
  const action = {
    id: `personal:import:${Date.now().toString(36)}`,
    name: translateMain('main.workspaceImport.runAction', 'Run'),
    script: scripts.run,
    targets: ['local' as const],
    shared: false
  }
  writeSecureFile(
    personalFile(repo.id),
    `${JSON.stringify(
      {
        actions: [...personal.actions, action],
        runMode: scripts.runMode ?? personal.runMode,
        previewUrls: personal.previewUrls
      },
      null,
      2
    )}\n`
  )
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('actions:changed', { repoId: repo.id })
    }
  }
}
