import type React from 'react'
import { AlertTriangle, Cloud, Loader2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { PendingWorktreeCreation } from '@/lib/workspace/creation/pending-worktree-creation'
import { selectWorktreeCreationSurfaceShown } from '@/lib/workspace/creation/worktree-creation-surface'
import { getFlushWorktreeCardPaddingLeft } from '@/components/sidebar/worktree-list/rows/indentation'

/** What the row says on hover and to a screen reader, in place of a second line. */
export function revioPendingRowStatus(
  entry: Pick<PendingWorktreeCreation, 'status' | 'error'>
): string {
  if (entry.status !== 'error') {
    return translate('auto.components.revioLayout.rowSettingUp', 'Setting up…')
  }
  const reason = entry.error?.split('\n')[0]?.trim()
  return reason
    ? translate('auto.components.revioLayout.pendingRowFailedReason', 'Setup failed: {{reason}}', {
        reason
      })
    : translate('auto.components.revioLayout.rowSetupFailed', 'Initialization failed')
}

export function openPendingCreation(creationId: string): void {
  const store = useAppStore.getState()
  store.setActivePendingWorktreeCreation(creationId)
  store.updatePendingWorktreeCreation(creationId, { loaderVisible: true })
  store.setActiveView('terminal')
}

/**
 * A workspace being created, drawn as a workspace row: the same frame, height and type, a spinner
 * (or a warning once it failed) where the status mark goes, and the cloud mark. The real row takes
 * its place once the workspace is listed (see revio-pending-rows).
 */
export function RevioPendingCreationRow({
  entry,
  cloud
}: {
  entry: PendingWorktreeCreation
  cloud: boolean
}): React.JSX.Element {
  const active = useAppStore(
    (s) => s.activePendingCreationId === entry.creationId && selectWorktreeCreationSurfaceShown(s)
  )
  const name = entry.request.displayName || entry.request.name
  const status = revioPendingRowStatus(entry)
  const isError = entry.status === 'error'
  return (
    <div
      role="button"
      tabIndex={0}
      title={status}
      aria-label={`${name}, ${status}`}
      aria-current={active ? 'page' : undefined}
      data-revio-pending-creation={entry.creationId}
      data-worktree-card-surface="true"
      data-worktree-card-active={active ? 'primary' : undefined}
      onClick={() => openPendingCreation(entry.creationId)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openPendingCreation(entry.creationId)
        }
      }}
      // The workspace row's card frame (worktree-card-surface), so both rows line up exactly.
      className={cn(
        'relative ml-1 flex w-[calc(100%-0.25rem)] cursor-pointer flex-col overflow-hidden rounded-lg border border-transparent pt-1.25 pr-1.5 pb-1.5 transition-[background-color,border-color,opacity,box-shadow] duration-200 outline-none select-none',
        !active && 'worktree-sidebar-card-hover'
      )}
      style={{ paddingLeft: getFlushWorktreeCardPaddingLeft(0) }}
    >
      <div
        data-worktree-card-parent-content=""
        className="flex h-[22px] min-w-0 items-center gap-2"
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          {isError ? (
            <AlertTriangle
              data-revio-pending-glyph="failed"
              className="size-3.5 text-[var(--revio-row-failing)]"
            />
          ) : (
            <Loader2
              data-revio-pending-glyph="setting-up"
              className="size-3.5 animate-spin text-muted-foreground"
            />
          )}
        </span>
        <span className="block min-w-0 flex-1 truncate text-[13px] leading-5 font-normal text-foreground">
          {name}
        </span>
        {cloud ? (
          <Cloud
            aria-label={translate('auto.components.revioLayout.cloudWorkspace', 'Cloud workspace')}
            className="size-3 shrink-0 text-muted-foreground"
          />
        ) : null}
      </div>
    </div>
  )
}
