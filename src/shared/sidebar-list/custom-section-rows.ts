import type { WorktreeOccurrencePlan, WorktreeOccurrenceSection } from '../worktree-occurrence-plan'
import type { WorktreeGroupEntry } from './worktree-group-entry'
import type { Worktree } from '../worktree/types'
import { getWorktreeExecutionHostId, type ExecutionHostId } from '../execution-host'
import { appendWorktreeRows } from './row-builders'
import type { RepoOfWorktree, Row } from './row-types'

/** A user's own sidebar section (custom sections), listed after the workspaces. */
export type SidebarCustomSection = {
  /** Header and collapse key; always starts with CUSTOM_SECTION_KEY_PREFIX. */
  key: string
  label: string
  worktreeIds: ReadonlySet<string>
}

export const CUSTOM_SECTION_KEY_PREFIX = 'custom-section:'

export function customSectionKey(sectionId: string): string {
  return `${CUSTOM_SECTION_KEY_PREFIX}${sectionId}`
}

export function isCustomSectionKey(key: string): boolean {
  return key.startsWith(CUSTOM_SECTION_KEY_PREFIX)
}

/** Splits top-level rows into the custom sections they were moved to and the rest. */
export function partitionCustomSections(
  rows: readonly Worktree[],
  sections: readonly SidebarCustomSection[]
): { rest: Worktree[]; bySection: Map<string, Worktree[]> } {
  const bySection = new Map<string, Worktree[]>(sections.map((section) => [section.key, []]))
  const rest: Worktree[] = []
  for (const row of rows) {
    const section = sections.find((candidate) => candidate.worktreeIds.has(row.id))
    if (section) {
      bySection.get(section.key)!.push(row)
    } else {
      rest.push(row)
    }
  }
  return { rest, bySection }
}

/** A custom section's header and rows; empty sections still show so workspaces can move in. */
export function emitCustomSection(
  section: SidebarCustomSection,
  items: readonly Worktree[],
  repoOf: RepoOfWorktree,
  defaultHostId: ExecutionHostId,
  collapsedGroups: Set<string>,
  result: Row[],
  occurrencePlan: WorktreeOccurrencePlan<Worktree>
): void {
  const hostWorktreeCounts = new Map<ExecutionHostId, number>()
  const hostWorktreeIds = new Map<ExecutionHostId, string[]>()
  for (const worktree of items) {
    const hostId = getWorktreeExecutionHostId(worktree, repoOf(worktree), defaultHostId)
    hostWorktreeCounts.set(hostId, (hostWorktreeCounts.get(hostId) ?? 0) + 1)
    hostWorktreeIds.set(hostId, [...(hostWorktreeIds.get(hostId) ?? []), worktree.id])
  }
  result.push({
    type: 'header',
    key: section.key,
    label: section.label,
    count: items.length,
    icon: { kind: 'all' },
    hostWorktreeCounts,
    hostWorktreeIds,
    worktreeIds: items.map((worktree) => worktree.id)
  })
  if (items.length === 0 || collapsedGroups.has(section.key)) {
    return
  }
  appendWorktreeRows(result, repoOf, occurrencePlan, {
    collapsedGroups,
    groupDepth: 0,
    sectionKey: section.key
  })
}

/** The occurrence-plan lanes for custom sections, so their rows (and lineage children) render there. */
export function customSectionLanes(
  sections: readonly SidebarCustomSection[],
  bySection: ReadonlyMap<string, Worktree[]>
): (WorktreeOccurrenceSection<Worktree> & { group: WorktreeGroupEntry })[] {
  return sections.map((section) => {
    const items = bySection.get(section.key) ?? []
    return {
      key: section.key,
      group: { label: section.label, items, repoIds: new Set<string>() },
      placement: 'natural',
      items,
      revealPath: { key: section.key }
    }
  })
}

/** Emits every custom section after the planned rows. */
export function appendCustomSections(
  rows: Row[],
  sections: readonly SidebarCustomSection[],
  context: {
    occurrencePlan: WorktreeOccurrencePlan<Worktree> & {
      sections: readonly { key: string; items: readonly Worktree[] }[]
    }
    repoOf: RepoOfWorktree
    defaultHostId: ExecutionHostId
    collapsedGroups: Set<string>
  }
): Row[] {
  for (const section of sections) {
    const lane = context.occurrencePlan.sections.find((candidate) => candidate.key === section.key)
    emitCustomSection(
      section,
      lane?.items ?? [],
      context.repoOf,
      context.defaultHostId,
      context.collapsedGroups,
      rows,
      context.occurrencePlan
    )
  }
  return rows
}
