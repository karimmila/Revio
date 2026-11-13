import React from 'react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { ActiveRightSidebarTab } from '@/store/slices/editor'
import { RIGHT_SIDEBAR_HEADER_NO_DRAG_CLASS_NAME } from '@/components/right-sidebar/right-sidebar-titlebar-drag-regions'
import { useWorkspaceChangeCount } from './revio-layout'
import { useRevioChangesMode } from './revio-changes-mode'

// The workspace layout's strip keeps only these; Orca's other panels stay out of the way.
// "Desktop" appears only for cloud workspaces (its item is cloud-only), last.
const REVIO_TABS: readonly ActiveRightSidebarTab[] = [
  'artifacts',
  'explorer',
  'source-control',
  'checks',
  'desktop'
]

export function filterRevioActivityItems<T extends { id: ActiveRightSidebarTab }>(
  items: readonly T[]
): T[] {
  return items.filter((item) => REVIO_TABS.includes(item.id))
}

function revioTabLabel(id: ActiveRightSidebarTab, fallback: string): string {
  if (id === 'explorer') {
    return translate('auto.components.revioLayout.allFiles', 'All files')
  }
  if (id === 'source-control') {
    return translate('auto.components.revioLayout.changes', 'Changes')
  }
  if (id === 'checks') {
    return translate('auto.components.revioLayout.checksTab', 'Checks')
  }
  if (id === 'artifacts') {
    return translate('auto.components.revioLayout.artifacts', 'Artifacts')
  }
  if (id === 'desktop') {
    return translate('auto.components.revioLayout.desktop', 'Desktop')
  }
  return fallback
}

/** A right-sidebar tab drawn as a text pill, as in the Files / Changes / Checks strip. */
export function RevioActivityTab({
  id,
  title,
  active,
  ariaLabel,
  attention,
  onClick
}: {
  id: ActiveRightSidebarTab
  title: string
  active: boolean
  ariaLabel: string
  attention: boolean
  onClick: () => void
}): React.JSX.Element {
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId ?? null)
  const changesMode = useRevioChangesMode()
  const changeCount = useWorkspaceChangeCount(
    id === 'source-control' ? activeWorktreeId : null,
    changesMode === 'all'
  )
  return (
    <button
      type="button"
      onClick={() => {
        // "All files" is the tree; ⌘⇧F's search in files lives on the same tab until then.
        if (id === 'explorer') {
          useAppStore.getState().setRightSidebarExplorerView('files')
        }
        onClick()
      }}
      data-workspace-board-dismiss=""
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'mx-0.5 flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs transition-colors',
        RIGHT_SIDEBAR_HEADER_NO_DRAG_CLASS_NAME,
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
      )}
    >
      <span className="whitespace-nowrap">{revioTabLabel(id, title)}</span>
      {changeCount > 0 ? (
        <span className="shrink-0 tabular-nums text-muted-foreground">{changeCount}</span>
      ) : null}
      {attention ? (
        <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
      ) : null}
    </button>
  )
}
