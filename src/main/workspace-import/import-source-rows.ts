import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { ImportSourceChat, ImportSourceWorkspace } from '../../shared/workspace-import-types'

export type ImportSourceMessageRow = { role: string; content: string; createdAt: string | null }

type Row = Record<string, unknown>

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

// The database is another app's file, so its values are checked before they become file names,
// folder names or git arguments.
const SESSION_ID = /^[\w-]{1,128}$/

/** One folder name: no separators and no `.` or `..`, so a joined path stays inside its parent. */
function isSingleFolderName(value: string): boolean {
  return value !== '.' && value !== '..' && !['/', '\\', '\0'].some((part) => value.includes(part))
}

/** A branch name git reads as a name: a leading `-` would be an option (`-M`, `--upload-pack=`). */
function branchName(value: unknown): string | null {
  const name = text(value)
  if (!name || name.startsWith('-') || name.includes('..') || name.endsWith('/')) {
    return null
  }
  const spaceOrControl = [...name].some((char) => char <= ' ' || char === '\x7f')
  return spaceOrControl || /[~^:?*[\\]/.test(name) ? null : name
}

/** Older databases lack some columns; those read as null instead of failing the query. */
function columnSelect(db: DatabaseSync, table: string, wanted: readonly string[]): string {
  const present = new Set(
    db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((column) => String(column.name))
  )
  return wanted.map((name) => (present.has(name) ? name : `NULL AS ${name}`)).join(', ')
}

const REPO_COLUMNS = ['id', 'name', 'remote_url', 'root_path'] as const
const WORKSPACE_COLUMNS = [
  'local_id',
  'repository_id',
  'directory_name',
  'workspace_name',
  'workspace_path',
  'branch',
  'intended_target_branch',
  'state',
  'DEPRECATED_archived',
  'hosting_server_url',
  'last_activity_at',
  'updated_at'
] as const
const SESSION_COLUMNS = [
  'id',
  'workspace_id',
  'claude_session_id',
  'agent_type',
  'title',
  'model',
  'last_user_message_at',
  'updated_at'
] as const

function selectAll(db: DatabaseSync, table: string, columns: readonly string[]): Row[] {
  return db.prepare(`SELECT ${columnSelect(db, table, columns)} FROM ${table}`).all()
}

function toChat(row: Row): ImportSourceChat | null {
  const providerSessionId = text(row.claude_session_id)
  // A chat without a CLI session never received a message; there is nothing to continue. The id
  // names the transcript file, so anything that is not a plain id is left out.
  if (!providerSessionId || !SESSION_ID.test(providerSessionId)) {
    return null
  }
  return {
    sourceId: String(row.id),
    agent: row.agent_type === 'codex' ? 'codex' : 'claude',
    providerSessionId,
    title: text(row.title) ?? '',
    model: text(row.model),
    lastActivityAt: text(row.last_user_message_at) ?? text(row.updated_at)
  }
}

export type ImportSourceRepoRows = Map<string, Record<string, unknown>>

export function readRepoRows(db: DatabaseSync): ImportSourceRepoRows {
  return new Map(selectAll(db, 'repos', REPO_COLUMNS).map((row) => [String(row.id), row]))
}

/** Cloud workspaces name repositories that only the local database lists, so repos are shared. */
export function readWorkspaceRows(
  db: DatabaseSync,
  kind: 'local' | 'cloud',
  cloudMirrorDir: string,
  repos: ImportSourceRepoRows
): ImportSourceWorkspace[] {
  const chatsByWorkspace = new Map<string, ImportSourceChat[]>()
  for (const row of selectAll(db, 'sessions', SESSION_COLUMNS)) {
    const chat = toChat(row)
    if (chat) {
      const key = String(row.workspace_id)
      chatsByWorkspace.set(key, [...(chatsByWorkspace.get(key) ?? []), chat])
    }
  }
  const workspaces: ImportSourceWorkspace[] = []
  for (const row of selectAll(db, 'workspaces', WORKSPACE_COLUMNS)) {
    const repo = repos.get(String(row.repository_id))
    const path = text(row.workspace_path)
    if (!repo || !path) {
      continue
    }
    const sourceId = String(row.local_id)
    const repoName = text(repo.name) ?? sourceId
    const cloud = kind === 'cloud' || text(row.hosting_server_url) !== null
    const mirror =
      isSingleFolderName(repoName) && isSingleFolderName(sourceId)
        ? join(cloudMirrorDir, repoName, sourceId)
        : null
    workspaces.push({
      sourceId,
      repoName,
      repoRemoteUrl: text(repo.remote_url),
      repoRootPath: text(repo.root_path),
      name: text(row.workspace_name) ?? text(row.directory_name) ?? sourceId,
      path,
      branch: branchName(row.branch),
      baseBranch: branchName(row.intended_target_branch),
      archived: row.state === 'archived' || Number(row.DEPRECATED_archived) === 1,
      cloud,
      // Only the place the mirror would be: reading the snapshot must not look into that folder.
      mirrorPath: cloud ? mirror : null,
      lastActivityAt: text(row.last_activity_at) ?? text(row.updated_at),
      chats: chatsByWorkspace.get(sourceId) ?? []
    })
  }
  return workspaces
}
