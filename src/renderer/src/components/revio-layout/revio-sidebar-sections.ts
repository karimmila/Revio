import type { RevioLayoutSettings } from '../../../../shared/revio-layout-settings-types'
import {
  customSectionKey,
  type SidebarCustomSection
} from '../../../../shared/sidebar-list/custom-section-rows'

type SectionSettings = Pick<
  RevioLayoutSettings,
  'revioLayout' | 'revioSidebarSections' | 'revioWorkspaceSections'
>

const NONE: readonly SidebarCustomSection[] = []
let cache: { from: SectionSettings | null; sections: readonly SidebarCustomSection[] } | null = null

/** The sidebar's custom sections from settings; none outside the workspace layout. */
export function revioCustomSections(
  settings: SectionSettings | null | undefined
): readonly SidebarCustomSection[] {
  if (!settings?.revioLayout || !settings.revioSidebarSections?.length) {
    return NONE
  }
  if (
    cache &&
    cache.from?.revioSidebarSections === settings.revioSidebarSections &&
    cache.from.revioWorkspaceSections === settings.revioWorkspaceSections
  ) {
    return cache.sections
  }
  const assigned = Object.entries(settings.revioWorkspaceSections ?? {})
  const sections = settings.revioSidebarSections.map((section) => ({
    key: customSectionKey(section.id),
    label: section.name,
    worktreeIds: new Set(
      assigned.filter(([, sectionId]) => sectionId === section.id).map(([worktreeId]) => worktreeId)
    )
  }))
  cache = { from: settings, sections }
  return sections
}

/** Settings after moving a workspace into a section, or out of every section with null. */
export function moveWorkspaceToSection(
  current: Record<string, string> | undefined,
  worktreeId: string,
  sectionId: string | null
): Record<string, string> {
  const next = { ...current }
  if (sectionId === null) {
    delete next[worktreeId]
  } else {
    next[worktreeId] = sectionId
  }
  return next
}

/** Settings after deleting a section: its workspaces go back to the main list. */
export function deleteSection(
  settings: SectionSettings,
  sectionId: string
): Pick<RevioLayoutSettings, 'revioSidebarSections' | 'revioWorkspaceSections'> {
  return {
    revioSidebarSections: (settings.revioSidebarSections ?? []).filter(
      (section) => section.id !== sectionId
    ),
    revioWorkspaceSections: Object.fromEntries(
      Object.entries(settings.revioWorkspaceSections ?? {}).filter(
        ([, assigned]) => assigned !== sectionId
      )
    )
  }
}
