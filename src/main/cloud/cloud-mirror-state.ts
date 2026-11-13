import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { writeSecureFile } from '../../shared/secure-file'
import { cloudDataRoot } from './cloud-repo-store'

const RecordSchema = z.object({
  repoId: z.string(),
  repoPath: z.string(),
  enabled: z.boolean(),
  mirrorPath: z.string(),
  branch: z.string(),
  createdBranch: z.boolean(),
  lastSyncedAt: z.number().nullable(),
  lastError: z.string().nullable()
})

export type MirrorRecord = z.infer<typeof RecordSchema>

const FileSchema = z.record(z.string(), RecordSchema)

function file(): string {
  return join(cloudDataRoot(), 'mirrors.json')
}

/** Each cloud workspace's mirror, keyed by its runtime id. */
export function readMirrorState(): Record<string, MirrorRecord> {
  if (!existsSync(file())) {
    return {}
  }
  const parsed = FileSchema.safeParse(JSON.parse(readFileSync(file(), 'utf8')))
  return parsed.success ? parsed.data : {}
}

export function writeMirrorState(runtimeId: string, record: MirrorRecord | null): void {
  const next = { ...readMirrorState() }
  if (record) {
    next[runtimeId] = record
  } else {
    delete next[runtimeId]
  }
  writeSecureFile(file(), `${JSON.stringify(next, null, 2)}\n`)
}
