import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { writeFileAtomically } from '../codex-accounts/fs-utils'
import type { AsleepCloudWorkspace } from '../../shared/asleep-cloud-workspace-types'

const ID = /^imp-[0-9a-f-]{36}$/

const RecordSchema = z.object({
  id: z.string().regex(ID),
  repoId: z.string().min(1).max(512),
  displayName: z.string().max(512),
  branch: z.string().min(1).max(1024),
  commit: z.string().regex(/^[0-9a-f]{7,64}$/),
  chats: z
    .array(
      z.object({
        agent: z.literal('claude'),
        providerSessionId: z.string().min(1).max(256),
        title: z.string().max(512).optional()
      })
    )
    .max(256),
  lastActivityAt: z.string().max(64).nullable()
})
const FileSchema = z.object({ workspaces: z.array(RecordSchema) })

export function isAsleepCloudWorkspaceId(id: string): boolean {
  return ID.test(id)
}

function root(userDataDir: string): string {
  return join(userDataDir, 'workspace-import')
}

function filePath(userDataDir: string): string {
  return join(root(userDataDir), 'asleep-cloud-workspaces.json')
}

/** The workspace's uncommitted work and chat transcripts, kept here until it wakes. */
export function asleepCloudPayloadDir(userDataDir: string, id: string): string {
  if (!isAsleepCloudWorkspaceId(id)) {
    throw new Error('Not an imported cloud workspace.')
  }
  return join(root(userDataDir), id)
}

export function readAsleepCloudWorkspaces(userDataDir: string): AsleepCloudWorkspace[] {
  try {
    const parsed = FileSchema.safeParse(JSON.parse(readFileSync(filePath(userDataDir), 'utf8')))
    return parsed.success ? parsed.data.workspaces : []
  } catch {
    return []
  }
}

function write(userDataDir: string, workspaces: AsleepCloudWorkspace[]): void {
  mkdirSync(root(userDataDir), { recursive: true })
  writeFileAtomically(filePath(userDataDir), `${JSON.stringify({ workspaces }, null, 2)}\n`)
}

export function saveAsleepCloudWorkspace(userDataDir: string, record: AsleepCloudWorkspace): void {
  const rest = readAsleepCloudWorkspaces(userDataDir).filter((entry) => entry.id !== record.id)
  write(userDataDir, [...rest, record])
}

export function findAsleepCloudWorkspace(
  userDataDir: string,
  id: string
): AsleepCloudWorkspace | null {
  return readAsleepCloudWorkspaces(userDataDir).find((entry) => entry.id === id) ?? null
}

/** Forgets the workspace and deletes what it kept; only once its sandbox holds all of it. */
export function removeAsleepCloudWorkspace(userDataDir: string, id: string): void {
  write(
    userDataDir,
    readAsleepCloudWorkspaces(userDataDir).filter((entry) => entry.id !== id)
  )
  const dir = asleepCloudPayloadDir(userDataDir, id)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
  }
}
