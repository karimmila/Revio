import { constants, copyFileSync, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  IMPORT_SOURCE_CLOUD_DATABASE_FILE,
  IMPORT_SOURCE_CLOUD_MIRROR_SEGMENTS,
  IMPORT_SOURCE_DATABASE_FILE,
  IMPORT_SOURCE_DATA_DIR_SEGMENTS
} from '../../shared/import-source-app'
import type { ImportSourceWorkspace } from '../../shared/workspace-import-types'
import {
  readRepoRows,
  readWorkspaceRows,
  type ImportSourceMessageRow,
  type ImportSourceRepoRows
} from './import-source-rows'

/** Dev and test runs point the importer at a copy of the source app's data. */
export const IMPORT_SOURCE_DATA_DIR_ENV = 'ORCA_IMPORT_SOURCE_DATA_DIR'
export const IMPORT_SOURCE_CLOUD_MIRROR_ENV = 'ORCA_IMPORT_SOURCE_CLOUD_MIRROR_DIR'

export function importSourceDataDir(env: NodeJS.ProcessEnv = process.env): string | null {
  const override = env[IMPORT_SOURCE_DATA_DIR_ENV]
  if (override) {
    return override
  }
  return process.platform === 'darwin' ? join(homedir(), ...IMPORT_SOURCE_DATA_DIR_SEGMENTS) : null
}

/** A cheap check for whether there is anything to offer, without copying the databases. */
export function isImportSourcePresent(env: NodeJS.ProcessEnv = process.env): boolean {
  const dataDir = importSourceDataDir(env)
  return dataDir !== null && existsSync(join(dataDir, IMPORT_SOURCE_DATABASE_FILE))
}

export function importSourceCloudMirrorDir(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env[IMPORT_SOURCE_CLOUD_MIRROR_ENV] || join(homedir(), ...IMPORT_SOURCE_CLOUD_MIRROR_SEGMENTS)
  )
}

export type ImportSourceSnapshot = {
  workspaces: ImportSourceWorkspace[]
  /** The chat's stored messages, oldest first, for chats whose CLI transcript is not on this Mac. */
  readChatMessages: (
    workspace: ImportSourceWorkspace,
    chatSourceId: string
  ) => ImportSourceMessageRow[]
  close: () => void
}

/** Far above any real database of the source app; a larger file is not read at all. */
export const MAX_IMPORT_DATABASE_BYTES = 4 * 1024 * 1024 * 1024

function copyDatabase(source: string, target: string): boolean {
  if (!existsSync(source)) {
    return false
  }
  const parts = ['', '-wal', '-shm'].filter((suffix) => existsSync(source + suffix))
  const bytes = parts.reduce((total, suffix) => total + statSync(source + suffix).size, 0)
  if (bytes > MAX_IMPORT_DATABASE_BYTES) {
    return false
  }
  for (const suffix of parts) {
    // A copy-on-write clone where the disk has them (APFS): no bytes move, so a large database
    // does not hold up the main process. Elsewhere this is an ordinary copy.
    copyFileSync(source + suffix, target + suffix, constants.COPYFILE_FICLONE)
  }
  return true
}

/**
 * The source app may be running, so each database is copied with its write-ahead log and only the
 * copy is opened; the original files are only ever read. Local workspaces live in one database and
 * cloud workspaces in the other, with the same tables.
 */
export function openImportSourceSnapshot(
  dataDir: string,
  cloudMirrorDir: string
): ImportSourceSnapshot | null {
  const scratch = mkdtempSync(join(tmpdir(), 'workspace-import-'))
  const databases = new Map<'local' | 'cloud', DatabaseSync>()
  const close = (): void => {
    for (const db of databases.values()) {
      db.close()
    }
    databases.clear()
    rmSync(scratch, { recursive: true, force: true })
  }
  try {
    const files = [
      ['local', IMPORT_SOURCE_DATABASE_FILE],
      ['cloud', IMPORT_SOURCE_CLOUD_DATABASE_FILE]
    ] as const
    for (const [kind, file] of files) {
      const copy = join(scratch, file)
      if (copyDatabase(join(dataDir, file), copy)) {
        databases.set(kind, new DatabaseSync(copy, { readOnly: true }))
      }
    }
    if (!databases.has('local')) {
      close()
      return null
    }
    const repos: ImportSourceRepoRows = new Map()
    for (const db of databases.values()) {
      for (const [id, row] of readRepoRows(db)) {
        repos.set(id, row)
      }
    }
    const workspaces: ImportSourceWorkspace[] = []
    for (const [kind, db] of databases) {
      workspaces.push(...readWorkspaceRows(db, kind, cloudMirrorDir, repos))
    }
    return {
      workspaces,
      readChatMessages: (workspace, chatSourceId) => {
        const db = databases.get(workspace.cloud ? 'cloud' : 'local')
        return db ? readChatMessageRows(db, chatSourceId) : []
      },
      close
    }
  } catch (error) {
    close()
    throw error
  }
}

function readChatMessageRows(db: DatabaseSync, chatSourceId: string): ImportSourceMessageRow[] {
  return db
    .prepare(
      'SELECT role, content, created_at FROM session_messages WHERE session_id = ? ORDER BY created_at, rowid'
    )
    .all(chatSourceId)
    .map((row) => ({
      role: String(row.role),
      content: typeof row.content === 'string' ? row.content : '',
      createdAt: typeof row.created_at === 'string' ? row.created_at : null
    }))
}
