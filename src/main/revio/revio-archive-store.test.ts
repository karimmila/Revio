import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  ArchivedWorkspaceSchema,
  MAX_RECORDS,
  addArchivedWorkspace,
  readArchivedWorkspaces,
  removeArchivedWorkspace
} from './revio-archive-store'
import { LEGACY_NAME } from '../../shared/legacy-name-migration'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'orca-archive-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const record = (id: string) => ({
  id,
  repoId: 'repo',
  displayName: id,
  branch: `feature/${id}`,
  archiveCommit: 'abc1234',
  archivedAt: 1,
  cloud: false
})

it('keeps the newest record first, replaces one with the same id, and removes by id', () => {
  addArchivedWorkspace(dir, record('a'))
  addArchivedWorkspace(dir, record('b'))
  addArchivedWorkspace(dir, { ...record('a'), archivedAt: 2 })
  expect(readArchivedWorkspaces(dir).map((entry) => [entry.id, entry.archivedAt])).toEqual([
    ['a', 2],
    ['b', 1]
  ])
  removeArchivedWorkspace(dir, 'a')
  expect(readArchivedWorkspaces(dir).map((entry) => entry.id)).toEqual(['b'])
})

it('past the cap drops the oldest local records, never a cloud restore point', () => {
  const cloud = {
    ...record('cloud-oldest'),
    cloud: true,
    cloudRestore: { projectId: 'p', snapshotId: 'snap_abc12345' }
  }
  const older = Array.from({ length: MAX_RECORDS - 1 }, (_, index) => record(`local-${index}`))
  mkdirSync(join(dir, 'workspace-archive'))
  writeFileSync(
    join(dir, 'workspace-archive', 'archived-workspaces.json'),
    JSON.stringify({ workspaces: [...older, cloud] })
  )
  const dropped = addArchivedWorkspace(dir, record('new'))
  const kept = readArchivedWorkspaces(dir).map((entry) => entry.id)
  expect(dropped.map((entry) => entry.id)).toEqual([`local-${MAX_RECORDS - 2}`])
  expect(kept).toHaveLength(MAX_RECORDS)
  expect(kept[0]).toBe('new')
  expect(kept.at(-1)).toBe('cloud-oldest')
})

it('reads a damaged file as empty', () => {
  mkdirSync(join(dir, 'workspace-archive'))
  writeFileSync(join(dir, 'workspace-archive', 'archived-workspaces.json'), '{not json')
  expect(readArchivedWorkspaces(dir)).toEqual([])
})

it('moves a file saved under the legacy folder to the new one, once', () => {
  mkdirSync(join(dir, LEGACY_NAME))
  writeFileSync(
    join(dir, LEGACY_NAME, 'archived-workspaces.json'),
    JSON.stringify({ workspaces: [record('old')] })
  )
  expect(readArchivedWorkspaces(dir).map((entry) => entry.id)).toEqual(['old'])
  expect(existsSync(join(dir, LEGACY_NAME))).toBe(false)
  expect(existsSync(join(dir, 'workspace-archive', 'archived-workspaces.json'))).toBe(true)
  addArchivedWorkspace(dir, record('new'))
  expect(readArchivedWorkspaces(dir).map((entry) => entry.id)).toEqual(['new', 'old'])
})

it('keeps the new file when both exist', () => {
  addArchivedWorkspace(dir, record('new'))
  mkdirSync(join(dir, LEGACY_NAME))
  writeFileSync(
    join(dir, LEGACY_NAME, 'archived-workspaces.json'),
    JSON.stringify({ workspaces: [record('old')] })
  )
  expect(readArchivedWorkspaces(dir).map((entry) => entry.id)).toEqual(['new'])
})

it('keeps the chats a record carries, and reads records without them', () => {
  const chats = [{ agent: 'claude', providerSessionId: 'session-1', title: 'Fix login' }]
  addArchivedWorkspace(dir, ArchivedWorkspaceSchema.parse({ ...record('a'), chats }))
  addArchivedWorkspace(dir, record('b'))
  expect(readArchivedWorkspaces(dir).map((entry) => entry.chats)).toEqual([undefined, chats])
})

it('keeps a cloud restore point and returns the records an add or remove dropped', () => {
  const cloud = ArchivedWorkspaceSchema.parse({
    ...record('c'),
    cloud: true,
    cloudRestore: { projectId: 'project-1', snapshotId: 'snap_abcdefgh12' }
  })
  expect(addArchivedWorkspace(dir, cloud)).toEqual([])
  expect(readArchivedWorkspaces(dir)[0].cloudRestore).toEqual({
    projectId: 'project-1',
    snapshotId: 'snap_abcdefgh12'
  })
  expect(
    addArchivedWorkspace(dir, { ...cloud, archivedAt: 5 }).map((entry) => entry.archivedAt)
  ).toEqual([1])
  expect(removeArchivedWorkspace(dir, 'c').map((entry) => entry.id)).toEqual(['c'])
  expect(removeArchivedWorkspace(dir, 'c')).toEqual([])
  expect(() =>
    ArchivedWorkspaceSchema.parse({ ...cloud, cloudRestore: { projectId: 'p', snapshotId: 'x' } })
  ).toThrow()
})

it('hands an unarchived workspace its checkpoint sessions back when it is archived again', () => {
  const local = (id: string, at: number) => ({
    ...record(id),
    archivedAt: at,
    checkpointSession: `archive-${at}`
  })
  addArchivedWorkspace(dir, local('a', 1))
  addArchivedWorkspace(dir, local('b', 2))
  // Unarchive: the record goes, its checkpoint stays under its ref.
  expect(removeArchivedWorkspace(dir, 'a', 'a').map((entry) => entry.id)).toEqual(['a'])
  addArchivedWorkspace(dir, local('a', 3))
  removeArchivedWorkspace(dir, 'a', 'a')
  addArchivedWorkspace(dir, local('a', 4))
  const [again, other] = readArchivedWorkspaces(dir)
  expect(again.checkpointSession).toBe('archive-4')
  expect(again.earlierCheckpointSessions).toEqual(['archive-3', 'archive-1'])
  expect(other.earlierCheckpointSessions).toBeUndefined()

  // Delete passes no id: nothing waits, so a later workspace at the same path owns none of them.
  removeArchivedWorkspace(dir, 'a')
  addArchivedWorkspace(dir, local('a', 5))
  expect(readArchivedWorkspaces(dir)[0].earlierCheckpointSessions).toBeUndefined()
})
