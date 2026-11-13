import { PINNED_GROUP_KEY } from './group-keys'
import { isCustomSectionKey } from './custom-section-rows'
import type { Row } from './row-types'

/** "Show more" at the end of a long sidebar section. */
export type ShowMoreRow = {
  type: 'show-more'
  key: string
  sectionKey: string
  hiddenCount: number
}

/** Rows "My workspaces" (every header that is neither Pinned nor a custom section) share. */
export const MAIN_SECTION_KEY = 'main'

export function showMoreSectionOf(headerKey: string): string {
  return headerKey === PINNED_GROUP_KEY || isCustomSectionKey(headerKey)
    ? headerKey
    : MAIN_SECTION_KEY
}

function topLevelWorktreeId(row: Row): string | null | undefined {
  if (row.type === 'item') {
    return row.depth === 0 ? row.worktree.id : undefined
  }
  if (row.type === 'folder-workspace') {
    return row.depth === 0 ? null : undefined
  }
  return undefined
}

/**
 * Keeps the first `limit` top-level rows of each section (with their nested rows) unless the
 * section was expanded, and ends a cut section with a Show more row. The active workspace always
 * stays visible. Headers and notices are never cut.
 */
export function capSidebarSections(
  rows: readonly Row[],
  options: { limit: number; expanded: ReadonlySet<string>; keepWorktreeId: string | null }
): Row[] {
  const result: Row[] = []
  let section: string | null = null
  let shown = 0
  let hidden = 0
  let hidingChildren = false
  const flush = (): void => {
    if (section !== null && hidden > 0) {
      result.push({
        type: 'show-more',
        key: `show-more:${section}`,
        sectionKey: section,
        hiddenCount: hidden
      })
    }
  }
  for (const row of rows) {
    if (row.type === 'header') {
      const next = showMoreSectionOf(row.key)
      if (next !== section) {
        flush()
        section = next
        shown = 0
        hidden = 0
      }
      hidingChildren = false
      result.push(row)
      continue
    }
    const topLevel = topLevelWorktreeId(row)
    if (topLevel === undefined) {
      if (!hidingChildren) {
        result.push(row)
      }
      continue
    }
    const keep =
      section === null ||
      options.expanded.has(section) ||
      shown < options.limit ||
      (topLevel !== null && topLevel === options.keepWorktreeId)
    hidingChildren = !keep
    if (keep) {
      shown += 1
      result.push(row)
    } else {
      hidden += 1
    }
  }
  flush()
  return result
}
