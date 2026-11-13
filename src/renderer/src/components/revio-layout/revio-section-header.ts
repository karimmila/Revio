import React from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { PINNED_GROUP_KEY } from '../../../../shared/sidebar-list/group-keys'
import {
  CUSTOM_SECTION_KEY_PREFIX,
  isCustomSectionKey
} from '../../../../shared/sidebar-list/custom-section-rows'

type SectionRow = { readonly type: string; readonly key?: string; readonly label?: string }

function revioLayoutOn(): boolean {
  return useAppStore.getState().settings?.revioLayout === true
}

function isFirstHeaderAfterPinned(rows: readonly SectionRow[], index: number): boolean {
  if (isCustomSectionKey(rows[index]?.key ?? '')) {
    return false
  }
  for (let previous = index - 1; previous >= 0; previous -= 1) {
    const candidate = rows[previous]
    if (candidate?.type === 'header') {
      return candidate.key === PINNED_GROUP_KEY
    }
  }
  return false
}

// Matches the 32px ::before label in main.css.
const SECTION_LABEL_HEIGHT = 32

/**
 * Header heights are estimated, not measured, so the estimate must match the chrome: every group
 * header folds away (the workspace layout lists workspaces flat, with no repository rows) except
 * the first one after the pins, which becomes the "My workspaces" label.
 */
export function adjustRevioHeaderSize(
  rows: readonly SectionRow[],
  index: number,
  size: number,
  enabled = revioLayoutOn()
): number {
  const row = rows[index]
  if (!enabled || row?.type !== 'header') {
    return size
  }
  if (row.key && isCustomSectionKey(row.key)) {
    return SECTION_LABEL_HEIGHT
  }
  return row.key !== PINNED_GROUP_KEY && isFirstHeaderAfterPinned(rows, index)
    ? SECTION_LABEL_HEIGHT
    : 0
}

/**
 * The workspace layout lists "Pinned" first and "My workspaces" after the pins, with no repository
 * rows. The sidebar title already names the first section, so headers fold away and the header
 * after the pins shows only the label.
 */
export function decorateRevioSectionHeader(
  header: React.JSX.Element,
  rows: readonly SectionRow[],
  index: number
): React.JSX.Element {
  const row = rows[index]
  if (!revioLayoutOn() || row?.type !== 'header') {
    return header
  }
  // A user's own section shows its name.
  if (row.key && isCustomSectionKey(row.key)) {
    return React.cloneElement(header, {
      'data-revio-section-label': row.label ?? '',
      'data-revio-section-drop': row.key.slice(CUSTOM_SECTION_KEY_PREFIX.length)
    })
  }
  if (row.key !== PINNED_GROUP_KEY && isFirstHeaderAfterPinned(rows, index)) {
    return React.cloneElement(header, {
      'data-revio-section-label': translate(
        'auto.components.revioLayout.myWorkspaces',
        'My workspaces'
      ),
      // Dropping a workspace here takes it out of its custom section.
      'data-revio-section-drop': ''
    })
  }
  return React.cloneElement(header, { 'data-revio-hidden-header': '' })
}

const NO_COLLAPSED_GROUPS = new Set<string>()

/** The list is flat: with no group headers to reopen them, no group stays collapsed. */
export function selectSidebarCollapsedGroups(state: {
  collapsedGroups: Set<string>
  settings: { revioLayout?: boolean } | null
}): Set<string> {
  return state.settings?.revioLayout === true ? NO_COLLAPSED_GROUPS : state.collapsedGroups
}
