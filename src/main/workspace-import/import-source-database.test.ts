import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  truncateSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  IMPORT_SOURCE_CLOUD_DATABASE_FILE,
  IMPORT_SOURCE_DATABASE_FILE
} from '../../shared/import-source-app'
import { MAX_IMPORT_DATABASE_BYTES, openImportSourceSnapshot } from './import-source-database'

// The source app's real column names; the cloud database has the same three tables.
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
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'import-source-db-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('openImportSourceSnapshot', () => {
  it('reads local and cloud workspaces with their resumable chats, leaving the source untouched', () => {
    const data = join(root, 'data')
    const mirrors = join(root, 'mirrors')
    mkdirSync(data)
    mkdirSync(join(mirrors, 'web', 'cloud-1'), { recursive: true })
    makeDatabase(
      join(data, IMPORT_SOURCE_DATABASE_FILE),
      `INSERT INTO repos VALUES ('r1','git@github.com:acme/web.git','web','main','/src/web');
       INSERT INTO workspaces (local_id, repository_id, directory_name, branch, state, workspace_path, workspace_name, last_activity_at)
         VALUES ('w1','r1','oslo','me/feature','ready','/ws/web/oslo','Feature work','2026-10-01T00:00:00Z'),
                ('w2','r1','lima','me/old','archived','/ws/web/lima',NULL,'2026-09-01T00:00:00Z');
       INSERT INTO sessions (id, claude_session_id, model, workspace_id, agent_type, title)
         VALUES ('s1','c-1','opus-5-5-1m','w1','claude','Plan it'),
                ('s2',NULL,'opus-5-5-1m','w1','claude','Untitled'),
                ('s3','t-9','gpt-5','w2','codex','Old chat');`
    )
    makeDatabase(
      join(data, IMPORT_SOURCE_CLOUD_DATABASE_FILE),
      `INSERT INTO workspaces (local_id, repository_id, directory_name, branch, state, hosting_server_url, workspace_path, workspace_name)
         VALUES ('cloud-1','r1','untitled','me/cloud','ready','https://cloud.example','/home/vm/web','Cloud work');
       INSERT INTO sessions (id, claude_session_id, workspace_id, agent_type, title) VALUES ('s9','c-9','cloud-1','claude','In the cloud');
       INSERT INTO session_messages VALUES ('m1','s9','user','hello','2026-11-01 10:00:00');`
    )
    const before = readFileSync(join(data, IMPORT_SOURCE_DATABASE_FILE))
    const mtime = statSync(join(data, IMPORT_SOURCE_DATABASE_FILE)).mtimeMs

    const snapshot = openImportSourceSnapshot(data, mirrors)
    expect(snapshot).not.toBeNull()
    const byId = new Map(snapshot!.workspaces.map((workspace) => [workspace.sourceId, workspace]))
    expect(byId.get('w1')).toMatchObject({
      name: 'Feature work',
      branch: 'me/feature',
      archived: false,
      cloud: false,
      mirrorPath: null,
      repoRemoteUrl: 'git@github.com:acme/web.git',
      repoRootPath: '/src/web'
    })
    expect(byId.get('w1')!.chats.map((chat) => chat.providerSessionId)).toEqual(['c-1'])
    expect(byId.get('w2')).toMatchObject({ name: 'lima', archived: true })
    expect(byId.get('w2')!.chats[0]).toMatchObject({ agent: 'codex', providerSessionId: 't-9' })
    const cloud = byId.get('cloud-1')!
    expect(cloud).toMatchObject({ cloud: true, mirrorPath: join(mirrors, 'web', 'cloud-1') })
    expect(snapshot!.readChatMessages(cloud, 's9')).toEqual([
      { role: 'user', content: 'hello', createdAt: '2026-11-01 10:00:00' }
    ])
    snapshot!.close()

    expect(readFileSync(join(data, IMPORT_SOURCE_DATABASE_FILE)).equals(before)).toBe(true)
    expect(statSync(join(data, IMPORT_SOURCE_DATABASE_FILE)).mtimeMs).toBe(mtime)
  })

  it('does not read a database far larger than the source app makes', () => {
    const data = join(root, 'data')
    mkdirSync(data)
    const file = join(data, IMPORT_SOURCE_DATABASE_FILE)
    writeFileSync(file, '')
    // A sparse file: the size is what counts, and no disk space is used.
    truncateSync(file, MAX_IMPORT_DATABASE_BYTES + 1)
    expect(openImportSourceSnapshot(data, root)).toBeNull()
  })

  it('finds nothing without the local database', () => {
    expect(openImportSourceSnapshot(join(root, 'missing'), root)).toBeNull()
  })

  it('refuses names from the database that would leave their folder or read as git options', () => {
    const data = join(root, 'data')
    const mirrors = join(root, 'mirrors')
    mkdirSync(data)
    mkdirSync(join(mirrors, 'web', 'cloud-1'), { recursive: true })
    mkdirSync(join(root, 'elsewhere'))
    makeDatabase(
      join(data, IMPORT_SOURCE_DATABASE_FILE),
      `INSERT INTO repos VALUES ('r1','git@github.com:acme/web.git','web','main','/src/web'),
                                ('r2','git@github.com:acme/api.git','..','main','/src/api');
       INSERT INTO workspaces (local_id, repository_id, directory_name, branch, intended_target_branch, state, hosting_server_url, workspace_path)
         VALUES ('w1','r1','oslo','--upload-pack=touch /tmp/x','-M','ready',NULL,'/ws/web/oslo'),
                ('../elsewhere','r1','lima','me/ok','main','ready','https://cloud.example','/home/vm/web'),
                ('elsewhere','r2','rome','a..b','main','ready','https://cloud.example','/home/vm/api');
       INSERT INTO sessions (id, claude_session_id, workspace_id, agent_type)
         VALUES ('s1','../../../.ssh/config','w1','claude'),
                ('s2','0b5c7a52-3f0e-4c57-9d0b-3a7d0c2f9a11','w1','claude');`
    )
    const snapshot = openImportSourceSnapshot(data, mirrors)
    const byId = new Map(snapshot!.workspaces.map((workspace) => [workspace.sourceId, workspace]))
    expect(byId.get('w1')).toMatchObject({ branch: null, baseBranch: null })
    expect(byId.get('w1')!.chats.map((chat) => chat.providerSessionId)).toEqual([
      '0b5c7a52-3f0e-4c57-9d0b-3a7d0c2f9a11'
    ])
    expect(byId.get('../elsewhere')).toMatchObject({ branch: 'me/ok', mirrorPath: null })
    expect(byId.get('elsewhere')).toMatchObject({ branch: null, mirrorPath: null })
    snapshot!.close()
  })
})
