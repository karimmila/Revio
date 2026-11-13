import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Fs from 'node:fs'
import type * as FsPromises from 'node:fs/promises'

// Every path any fs call is given, so the test can say which folders detection opened.
const seen = vi.hoisted(() => {
  const paths: string[] = []
  const gitCalls: string[] = []
  const record = (args: readonly unknown[]): void => {
    for (const arg of args) {
      // Absolute strings are the paths; the rest are encodings and flags.
      if (typeof arg === 'string' && arg.startsWith('/')) {
        paths.push(arg)
      }
    }
  }
  /** The module with every function replaced by one that notes its path arguments first. */
  const recording = <T extends object>(actual: T): T => {
    const wrapped: Record<string, unknown> = {}
    for (const [name, value] of Object.entries(actual)) {
      wrapped[name] =
        typeof value === 'function' && !/^[A-Z]/.test(name)
          ? (...args: unknown[]): unknown => {
              record(args)
              return value.call(actual, ...args)
            }
          : value
    }
    return Object.assign(Object.create(Object.getPrototypeOf(actual)), wrapped)
  }
  return { paths, recording, gitCalls }
})

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof Fs>()
  const wrapped = seen.recording(actual)
  return { ...wrapped, default: wrapped, promises: seen.recording(actual.promises) }
})
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>()
  const wrapped = seen.recording(actual)
  return { ...wrapped, default: wrapped }
})
vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }))
vi.mock('./workspace-import-git', () => ({
  git: async (cwd: string) => {
    seen.gitCalls.push(cwd)
    throw new Error('not a git repository')
  }
}))

import {
  IMPORT_SOURCE_CLOUD_DATABASE_FILE,
  IMPORT_SOURCE_DATABASE_FILE,
  IMPORT_SOURCE_REPO_SETTINGS_FILES
} from '../../shared/import-source-app'
import {
  IMPORT_SOURCE_CLOUD_MIRROR_ENV,
  IMPORT_SOURCE_DATA_DIR_ENV
} from './import-source-database'
import { detectWorkspaceImport, prepareWorkspaceImport } from './workspace-import-detect'

const SCHEMA = `
CREATE TABLE repos (id TEXT PRIMARY KEY, remote_url TEXT, name TEXT, default_branch TEXT, root_path TEXT);
CREATE TABLE workspaces (local_id TEXT PRIMARY KEY, repository_id TEXT, directory_name TEXT,
  DEPRECATED_archived INTEGER DEFAULT 0, branch TEXT, state TEXT DEFAULT 'active',
  intended_target_branch TEXT, hosting_server_url TEXT, workspace_path TEXT, workspace_name TEXT,
  last_activity_at TEXT, updated_at TEXT);
CREATE TABLE sessions (id TEXT PRIMARY KEY, claude_session_id TEXT, model TEXT, workspace_id TEXT,
  is_hidden INTEGER DEFAULT 0, agent_type TEXT, title TEXT, last_user_message_at TEXT, updated_at TEXT);
CREATE TABLE session_messages (id TEXT PRIMARY KEY, session_id TEXT, role TEXT, content TEXT, created_at TEXT);
`

function makeDatabase(path: string, rows: string): void {
  const db = new DatabaseSync(path)
  db.exec(SCHEMA)
  db.exec(rows)
  db.close()
}

let root: string
let data: string
let userData: string
let desktop: string
let mirrors: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'import-detect-'))
  data = join(root, 'Library', 'Application Support', 'source-app')
  userData = join(root, 'Library', 'Application Support', 'this-app')
  // Stands for a folder macOS guards: the repository, a workspace and a mirror all live in it.
  desktop = join(root, 'Desktop')
  mirrors = join(desktop, 'remote-workspace-sync')
  const repo = join(desktop, 'web')
  mkdirSync(data, { recursive: true })
  mkdirSync(userData, { recursive: true })
  mkdirSync(join(repo, IMPORT_SOURCE_REPO_SETTINGS_FILES[1], '..'), { recursive: true })
  mkdirSync(join(desktop, 'workspaces', 'oslo'), { recursive: true })
  mkdirSync(join(mirrors, 'web', 'cloud-1'), { recursive: true })
  writeFileSync(
    join(repo, IMPORT_SOURCE_REPO_SETTINGS_FILES[1]),
    '[scripts]\nsetup = "pnpm install"\nrun = "pnpm dev"\n'
  )
  makeDatabase(
    join(data, IMPORT_SOURCE_DATABASE_FILE),
    `INSERT INTO repos VALUES ('r1','git@github.com:acme/web.git','web','main','${repo}');
     INSERT INTO workspaces (local_id, repository_id, directory_name, branch, state, workspace_path, workspace_name)
       VALUES ('w1','r1','oslo','me/feature','ready','${join(desktop, 'workspaces', 'oslo')}','Feature work');
     INSERT INTO sessions (id, claude_session_id, workspace_id, agent_type, title) VALUES ('s1','c-1','w1','claude','Plan it');`
  )
  makeDatabase(
    join(data, IMPORT_SOURCE_CLOUD_DATABASE_FILE),
    `INSERT INTO workspaces (local_id, repository_id, directory_name, branch, state, hosting_server_url, workspace_path, workspace_name)
       VALUES ('cloud-1','r1','untitled','me/cloud','ready','https://cloud.example','/home/vm/web','Cloud work');`
  )
  vi.stubEnv(IMPORT_SOURCE_DATA_DIR_ENV, data)
  vi.stubEnv(IMPORT_SOURCE_CLOUD_MIRROR_ENV, mirrors)
  seen.paths.length = 0
  seen.gitCalls.length = 0
})
afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(root, { recursive: true, force: true })
})

describe('workspace import detection', () => {
  it('reads the source app’s data folder and never a repository, workspace or mirror folder', () => {
    const detection = detectWorkspaceImport(userData)

    expect(detection).toMatchObject({
      found: true,
      summary: {
        repoNames: ['web'],
        pending: { active: { workspaces: 2, chats: 1 } },
        hasMirroredChanges: true
      }
    })
    const scratch = join(tmpdir(), 'workspace-import-')
    const allowed = [data, userData, scratch]
    expect(seen.paths.length).toBeGreaterThan(0)
    expect(seen.paths.filter((path) => !allowed.some((dir) => path.startsWith(dir)))).toEqual([])
    expect(seen.paths.filter((path) => path.startsWith(desktop))).toEqual([])
    expect(seen.gitCalls).toEqual([])
  })

  it('reads the repositories’ scripts only in the step that follows Import', async () => {
    const prepared = await prepareWorkspaceImport(userData)

    expect(prepared.repositoryScripts).toMatchObject([
      { repoName: 'web', setup: 'pnpm install', run: 'pnpm dev' }
    ])
    const repo = join(desktop, 'web')
    expect(seen.paths).toContain(join(repo, IMPORT_SOURCE_REPO_SETTINGS_FILES[1]))
    expect(seen.gitCalls).toEqual([repo])
  })

  it('finds nothing when the source app was never used on this Mac', () => {
    vi.stubEnv(IMPORT_SOURCE_DATA_DIR_ENV, join(root, 'nowhere'))
    expect(detectWorkspaceImport(userData)).toEqual({ found: false })
  })
})
