import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { ArchivedWorkspace } from '../../../shared/revio-archive-types'

// The archive record is written a moment after the worktree goes; Undo waits for it this long.
const RECORD_WAIT_MS = 300
const RECORD_TRIES = 10

async function archivedRecord(id: string): Promise<ArchivedWorkspace | null> {
  for (let attempt = 0; attempt < RECORD_TRIES; attempt += 1) {
    const record = (await window.api.revioArchive?.list().catch(() => []))?.find(
      (candidate) => candidate.id === id
    )
    if (record) {
      return record
    }
    await new Promise((resolve) => setTimeout(resolve, RECORD_WAIT_MS))
  }
  return null
}

// The toast of each archived workspace, so it can go once the workspace is deleted for good.
const shownToasts = new Map<string, string | number>()

/** Undo would bring back a workspace that no longer exists: its toast goes with it. */
export function dismissArchiveToast(worktreeId: string): void {
  const id = shownToasts.get(worktreeId)
  if (id !== undefined) {
    shownToasts.delete(worktreeId)
    toast.dismiss(id)
  }
}

/**
 * A local workspace archived loses nothing: uncommitted work is in its archive checkpoint and
 * returns on Unarchive. Archiving asks nothing, so this says it, with Undo. It mentions the
 * uncommitted changes only when the workspace had some.
 */
export function showArchiveKeptChangesToast(
  worktreeId: string,
  displayName: string,
  unarchive: (
    record: ArchivedWorkspace,
    confirmNewBranch?: undefined,
    onRestored?: (worktreeId: string) => void
  ) => Promise<boolean>,
  options: {
    /** Opens the restored workspace, so Undo ends where the archive began. */
    openRestored?: (worktreeId: string) => void
    hadUncommittedChanges: boolean
  }
): void {
  dismissArchiveToast(worktreeId)
  const id = toast.success(
    translate('auto.lib.revioArchive.keptChanges', 'Archived {{value0}}', { value0: displayName }),
    {
      description: options.hadUncommittedChanges
        ? translate(
            'auto.lib.revioArchive.keptChangesDetail',
            'Its uncommitted changes are kept. Unarchive it from Home to get them back.'
          )
        : translate(
            'auto.lib.revioArchive.archivedDetail',
            'Unarchive it from Home to get it back.'
          ),
      duration: 10_000,
      onDismiss: () => shownToasts.delete(worktreeId),
      onAutoClose: () => shownToasts.delete(worktreeId),
      action: {
        label: translate('auto.lib.revioArchive.undo', 'Undo'),
        onClick: () =>
          void archivedRecord(worktreeId).then((record) => {
            if (record) {
              return unarchive(record, undefined, options.openRestored)
            }
            toast.error(
              translate(
                'auto.lib.revioArchive.undoUnavailable',
                'Could not undo. Unarchive {{value0}} from Home, under Only archived.',
                { value0: displayName }
              )
            )
            return false
          })
      }
    }
  )
  shownToasts.set(worktreeId, id)
}
