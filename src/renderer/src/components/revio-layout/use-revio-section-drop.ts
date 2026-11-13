import { useEffect } from 'react'
import { useAppStore } from '@/store'
import {
  hasWorkspaceDragData,
  readWorkspaceDragDataIds
} from '@/components/sidebar/workspace-status/presentation/workspace-status-drag-data'
import { moveWorkspaceToSection } from './revio-sidebar-sections'

/** The header attribute a workspace is dropped on: a section id, or empty for "My workspaces". */
export const SECTION_DROP_ATTR = 'data-revio-section-drop'
const ACTIVE_ATTR = 'data-revio-section-drop-active'

function dropTarget(event: DragEvent): HTMLElement | null {
  return event.target instanceof Element
    ? event.target.closest<HTMLElement>(`[${SECTION_DROP_ATTR}]`)
    : null
}

/** Every workspace id moved into `sectionId` (or out of all sections with null). */
export function moveWorkspacesToSection(
  current: Record<string, string> | undefined,
  worktreeIds: readonly string[],
  sectionId: string | null
): Record<string, string> {
  return worktreeIds.reduce(
    (assigned, worktreeId) => moveWorkspaceToSection(assigned, worktreeId, sectionId),
    current ?? {}
  )
}

/** "Drag a workspace here": dropping workspace rows on a section header moves them. */
export function useRevioSectionDrop(): void {
  useEffect(() => {
    let highlighted: HTMLElement | null = null
    const highlight = (next: HTMLElement | null): void => {
      highlighted?.removeAttribute(ACTIVE_ATTR)
      highlighted = next
      highlighted?.setAttribute(ACTIVE_ATTR, '')
    }
    const onDragOver = (event: DragEvent): void => {
      const target = dropTarget(event)
      if (!target || !event.dataTransfer || !hasWorkspaceDragData(event.dataTransfer)) {
        highlight(null)
        return
      }
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      highlight(target)
    }
    const onDrop = (event: DragEvent): void => {
      const target = dropTarget(event)
      highlight(null)
      if (!target || !event.dataTransfer || !hasWorkspaceDragData(event.dataTransfer)) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const ids = readWorkspaceDragDataIds(event.dataTransfer)
      const sectionId = target.getAttribute(SECTION_DROP_ATTR) || null
      const state = useAppStore.getState()
      void state.updateSettings({
        revioWorkspaceSections: moveWorkspacesToSection(
          state.settings?.revioWorkspaceSections,
          ids,
          sectionId
        )
      })
    }
    const onDragEnd = (): void => highlight(null)
    document.addEventListener('dragover', onDragOver, true)
    document.addEventListener('drop', onDrop, true)
    document.addEventListener('dragend', onDragEnd, true)
    return () => {
      document.removeEventListener('dragover', onDragOver, true)
      document.removeEventListener('drop', onDrop, true)
      document.removeEventListener('dragend', onDragEnd, true)
      highlight(null)
    }
  }, [])
}
