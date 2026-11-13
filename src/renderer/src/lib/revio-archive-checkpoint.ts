import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { ArchivedWorkspace } from '../../../shared/revio-archive-types'

// Archive waits this long at most for the checkpoint, so archiving is never held up for long.
const SAVE_WAIT_MS = 4000

export function archiveCheckpointSession(archivedAt: number): string {
  return `archive-${archivedAt}`
}

/**
 * Keeps the workspace's uncommitted and untracked work (archive checkpoint) under a
 * private ref before its worktree goes. Resolves to the checkpoint session, or null when there is
 * nothing to keep or the save did not finish in time.
 */
export async function saveArchiveCheckpoint(
  worktreePath: string,
  archivedAt: number
): Promise<string | null> {
  const sessionId = archiveCheckpointSession(archivedAt)
  const save = window.api.turnCheckpoints?.save({ worktreePath, sessionId })
  const ref = await Promise.race([
    Promise.resolve(save).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), SAVE_WAIT_MS))
  ])
  return ref ? sessionId : null
}

/**
 * Puts the archived work back into the reopened worktree. When the branch moved since the archive
 * the checkpoint would reset it, so the work stays under its ref and the person is told.
 */
export async function restoreArchiveCheckpoint(
  created: { path: string; head: string },
  record: Pick<ArchivedWorkspace, 'archiveCommit' | 'checkpointSession' | 'displayName'>
): Promise<boolean> {
  if (!record.checkpointSession) {
    return false
  }
  if (
    !created.head.startsWith(record.archiveCommit) &&
    !record.archiveCommit.startsWith(created.head)
  ) {
    toast.message(
      translate(
        'auto.lib.revioArchive.branchMoved',
        'The branch moved since {{value0}} was archived, so its uncommitted work was not put back.',
        { value0: record.displayName }
      )
    )
    return false
  }
  const restored = await window.api.turnCheckpoints
    ?.restore({
      worktreePath: created.path,
      sessionId: record.checkpointSession,
      before: Number.MAX_SAFE_INTEGER
    })
    .catch(() => false)
  return restored === true
}
