import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import type { ArchivedWorkspace } from '../../shared/revio-archive-types'
import { LEGACY_NAME } from '../../shared/legacy-name-migration'

export const ArchivedChatsSchema = z
  .array(
    z.object({
      agent: z.string().min(1).max(64),
      sessionId: z.string().min(1).max(256).optional(),
      providerSessionId: z.string().min(1).max(256).optional(),
      title: z.string().max(512).optional()
    })
  )
  .max(64)

const CheckpointSessionSchema = z.string().regex(/^[\w.-]{1,128}$/)

export const ArchivedWorkspaceSchema = z.object({
  id: z.string().min(1).max(4096),
  repoId: z.string().min(1).max(512),
  displayName: z.string().max(512),
  branch: z.string().max(1024).nullable(),
  archiveCommit: z.string().regex(/^[0-9a-f]{7,64}$/),
  archivedAt: z.number().int().nonnegative(),
  cloud: z.boolean(),
  checkpointSession: CheckpointSessionSchema.optional(),
  earlierCheckpointSessions: z.array(CheckpointSessionSchema).max(64).optional(),
  chats: ArchivedChatsSchema.optional(),
  cloudRestore: z
    .object({
      projectId: z.string().min(1).max(512),
      snapshotId: z
        .string()
        .regex(/^snap_\w{8,64}$/)
        .nullable()
    })
    .optional()
})

/**
 * Checkpoint sessions of a workspace that was unarchived: its record is gone, but its archive
 * checkpoint stays under its ref (the restore can leave the work there). They wait here, under the
 * id the workspace came back with, for its next archive record.
 */
const UnarchivedCheckpointsSchema = z.object({
  workspaceId: z.string().min(1).max(4096),
  repoId: z.string().min(1).max(512),
  sessions: z.array(CheckpointSessionSchema).max(64)
})
type UnarchivedCheckpoints = z.infer<typeof UnarchivedCheckpointsSchema>

const FileSchema = z.object({
  workspaces: z.array(ArchivedWorkspaceSchema),
  unarchivedCheckpoints: z.array(UnarchivedCheckpointsSchema).optional()
})
type ArchiveFile = {
  workspaces: ArchivedWorkspace[]
  unarchivedCheckpoints: UnarchivedCheckpoints[]
}

// One record per archived workspace; past this the oldest go, as the list is for recent work.
export const MAX_RECORDS = 500

/**
 * Trims the list to the cap, oldest first. A cloud record with a restore point is never trimmed:
 * dropping it deletes the snapshot, the only copy of that workspace's work, and only Delete or
 * Unarchive may do that.
 */
function trimToCap(newestFirst: ArchivedWorkspace[]): ArchivedWorkspace[] {
  let excess = newestFirst.length - MAX_RECORDS
  if (excess <= 0) {
    return newestFirst
  }
  const kept = newestFirst.toReversed().filter((entry) => {
    if (excess > 0 && !entry.cloudRestore?.snapshotId) {
      excess -= 1
      return false
    }
    return true
  })
  return kept.toReversed()
}

const FILE_NAME = 'archived-workspaces.json'

function filePath(userDataPath: string): string {
  return join(userDataPath, 'workspace-archive', FILE_NAME)
}

/** Builds before 2026-11-10 kept the file in a folder under the legacy name; move it once. */
function moveLegacyArchiveFile(userDataPath: string, path: string): void {
  const legacyDir = join(userDataPath, LEGACY_NAME)
  const legacyPath = join(legacyDir, FILE_NAME)
  if (existsSync(path) || !existsSync(legacyPath)) {
    return
  }
  try {
    mkdirSync(dirname(path), { recursive: true })
    renameSync(legacyPath, path)
    if (readdirSync(legacyDir).length === 0) {
      rmdirSync(legacyDir)
    }
  } catch {
    // Left in place; the next read tries again.
  }
}

function readFile(userDataPath: string): ArchiveFile {
  const path = filePath(userDataPath)
  moveLegacyArchiveFile(userDataPath, path)
  if (!existsSync(path)) {
    return { workspaces: [], unarchivedCheckpoints: [] }
  }
  try {
    const parsed = FileSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')))
    return parsed.success
      ? {
          workspaces: parsed.data.workspaces,
          unarchivedCheckpoints: parsed.data.unarchivedCheckpoints ?? []
        }
      : { workspaces: [], unarchivedCheckpoints: [] }
  } catch {
    return { workspaces: [], unarchivedCheckpoints: [] }
  }
}

export function readArchivedWorkspaces(userDataPath: string): ArchivedWorkspace[] {
  return readFile(userDataPath).workspaces
}

function write(userDataPath: string, file: ArchiveFile): void {
  const path = filePath(userDataPath)
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.tmp`
  writeFileSync(temp, JSON.stringify(file, null, 2), { mode: 0o600 })
  renameSync(temp, path)
}

/** Every checkpoint session a local record owns: its own and those of its earlier archives. */
export function archiveCheckpointSessions(
  record: Pick<ArchivedWorkspace, 'cloud' | 'checkpointSession' | 'earlierCheckpointSessions'>
): string[] {
  if (record.cloud) {
    return []
  }
  return [
    ...new Set([
      ...(record.checkpointSession ? [record.checkpointSession] : []),
      ...(record.earlierCheckpointSessions ?? [])
    ])
  ]
}

/** Returns the records this add pushed out (a replaced one with the same id, or the oldest). */
export function addArchivedWorkspace(
  userDataPath: string,
  record: ArchivedWorkspace
): ArchivedWorkspace[] {
  const file = readFile(userDataPath)
  const waiting = file.unarchivedCheckpoints.filter(
    (entry) => entry.workspaceId === record.id && entry.repoId === record.repoId
  )
  const earlier = archiveCheckpointSessions({
    cloud: record.cloud,
    earlierCheckpointSessions: [
      ...(record.earlierCheckpointSessions ?? []),
      ...waiting.flatMap((entry) => entry.sessions)
    ]
  }).filter((session) => session !== record.checkpointSession)
  const added: ArchivedWorkspace =
    earlier.length > 0 ? { ...record, earlierCheckpointSessions: earlier } : record
  const rest = file.workspaces.filter((entry) => entry.id !== record.id)
  const kept = trimToCap([added, ...rest])
  write(userDataPath, {
    workspaces: kept,
    unarchivedCheckpoints: file.unarchivedCheckpoints.filter((entry) => !waiting.includes(entry))
  })
  return file.workspaces.filter((entry) => !kept.includes(entry))
}

/**
 * Returns the removed records. Unarchive passes `unarchivedAs`, the id the workspace came back
 * with: the record's checkpoint sessions then wait for that workspace's next archive, so a later
 * Delete can remove their refs. Delete passes none, as it removes the refs itself.
 */
export function removeArchivedWorkspace(
  userDataPath: string,
  id: string,
  unarchivedAs?: string
): ArchivedWorkspace[] {
  const file = readFile(userDataPath)
  const removed = file.workspaces.filter((entry) => entry.id === id)
  const waiting =
    unarchivedAs === undefined
      ? []
      : removed
          .map((record) => ({
            workspaceId: unarchivedAs,
            repoId: record.repoId,
            sessions: archiveCheckpointSessions(record)
          }))
          .filter((entry) => entry.sessions.length > 0)
  write(userDataPath, {
    workspaces: file.workspaces.filter((entry) => entry.id !== id),
    unarchivedCheckpoints: [...waiting, ...file.unarchivedCheckpoints].slice(0, MAX_RECORDS)
  })
  return removed
}
