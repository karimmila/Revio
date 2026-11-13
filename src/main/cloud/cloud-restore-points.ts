import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { writeSecureFile } from '../../shared/secure-file'
import { cloudDataRoot } from './cloud-repo-store'

/**
 * The ledger of snapshots kept as archived workspaces' restore points. Its own module so
 * `retireSandbox` can consult it without importing the archive code that calls it.
 */
const LedgerSchema = z.object({ snapshots: z.array(z.string()) })

function ledgerFile(): string {
  return join(cloudDataRoot(), 'archive-restore-points.json')
}

/** Snapshots kept as archived workspaces' restore points; inventory treats them as in use. */
export function restorePointIds(): Set<string> {
  try {
    if (!existsSync(ledgerFile())) {
      return new Set()
    }
    const parsed = LedgerSchema.safeParse(JSON.parse(readFileSync(ledgerFile(), 'utf8')))
    return new Set(parsed.success ? parsed.data.snapshots : [])
  } catch {
    return new Set()
  }
}

function writeRestorePoints(ids: Set<string>): void {
  writeSecureFile(ledgerFile(), `${JSON.stringify({ snapshots: [...ids] }, null, 2)}\n`)
}

export function recordRestorePoint(snapshotId: string): void {
  const ids = restorePointIds()
  ids.add(snapshotId)
  writeRestorePoints(ids)
}

export function forgetRestorePoint(snapshotId: string): void {
  const ids = restorePointIds()
  if (ids.delete(snapshotId)) {
    writeRestorePoints(ids)
  }
}
