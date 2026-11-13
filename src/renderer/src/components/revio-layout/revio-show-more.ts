import React from 'react'
import { useAppStore } from '@/store'
import type { Row } from '../../../../shared/sidebar-list/row-types'
import { capSidebarSections } from '../../../../shared/sidebar-list/section-show-more'

// Sections a person opened with "Show more", for this run of the app.
let expanded: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()

export function expandSidebarSection(sectionKey: string): void {
  if (expanded.has(sectionKey)) {
    return
  }
  expanded = new Set([...expanded, sectionKey])
  for (const listener of listeners) {
    listener()
  }
}

export function expandedSidebarSections(): ReadonlySet<string> {
  return expanded
}

export function useExpandedSidebarSections(): ReadonlySet<string> {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => expanded
  )
}

/** How many top-level workspaces a sidebar section shows before "Show more". */
export const SIDEBAR_SECTION_LIMIT = 12

/** The workspace layout's section cap over planned rows; Orca's own layout keeps every row. */
export function applyRevioShowMore(
  rows: Row[],
  settings: { revioLayout?: boolean } | null | undefined,
  expandedSections: ReadonlySet<string>,
  activeWorktreeId: string | null
): Row[] {
  return settings?.revioLayout === true
    ? capSidebarSections(rows, {
        limit: SIDEBAR_SECTION_LIMIT,
        expanded: expandedSections,
        keepWorktreeId: activeWorktreeId
      })
    : rows
}

/**
 * What the cap reads; the active row only matters in the workspace layout, so Orca's list ignores
 * it.
 */
export function useRevioShowMoreInputs(): {
  expandedSections: ReadonlySet<string>
  activeWorktreeId: string | null
} {
  const expandedSections = useExpandedSidebarSections()
  const activeWorktreeId = useAppStore((s) =>
    s.settings?.revioLayout === true ? s.activeWorktreeId : null
  )
  return { expandedSections, activeWorktreeId }
}
