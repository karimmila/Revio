import { useAppStore } from '@/store'
import { toggleDiffFileViewed } from '@/lib/diff-viewed-store'
import {
  COMBINED_DIFF_HEADER_SELECTOR,
  COMBINED_DIFF_ROW_SELECTOR,
  COMBINED_DIFF_VIEWPORT_SELECTOR
} from '@/components/editor/combined-diff/scroll-viewport/combined-diff-viewport'

const ALL_DIFFS = '::all-diffs::'

function typingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || !!target.closest('input, textarea, select, .monaco-editor'))
  )
}

/** The file whose row starts at or above the top of the diff on screen. */
function currentRow(viewport: HTMLElement): { rows: HTMLElement[]; index: number } {
  const top = viewport.getBoundingClientRect().top + 4
  const rows = [...viewport.querySelectorAll<HTMLElement>(COMBINED_DIFF_ROW_SELECTOR)]
  let index = 0
  rows.forEach((row, at) => {
    if (row.getBoundingClientRect().top <= top) {
      index = at
    }
  })
  return { rows, index }
}

/**
 * The diff keys in the all-changes diff: ↑/↓ go to the previous or next file, ⌃V marks
 * the file in view as viewed (and folds it). Keys typed into an editor or field stay there.
 * Returns true when the key was handled.
 */
export function handleRevioDiffKey(event: KeyboardEvent): boolean {
  const activeFileId = useAppStore.getState().activeFileId ?? ''
  if (
    !activeFileId.includes(ALL_DIFFS) ||
    event.metaKey ||
    event.altKey ||
    typingTarget(event.target)
  ) {
    return false
  }
  const viewport = document.querySelector<HTMLElement>(COMBINED_DIFF_VIEWPORT_SELECTOR)
  if (!viewport) {
    return false
  }
  const { rows, index } = currentRow(viewport)
  if (!event.ctrlKey && !event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    const target = rows[index + (event.key === 'ArrowDown' ? 1 : -1)]
    if (!target) {
      return false
    }
    viewport.scrollTop += target.getBoundingClientRect().top - viewport.getBoundingClientRect().top
    return true
  }
  if (event.ctrlKey && !event.shiftKey && event.code === 'KeyV') {
    const header = rows[index]?.querySelector<HTMLElement>(COMBINED_DIFF_HEADER_SELECTOR)
    const path = header?.dataset.diffSectionPath
    const change = header?.dataset.diffSectionChange
    if (!header || !path || !change) {
      return false
    }
    const worktreeId = activeFileId.slice(0, activeFileId.indexOf(ALL_DIFFS))
    const expanded = !!header.querySelector('.lucide-chevron-down')
    if (toggleDiffFileViewed(worktreeId, path, change) && expanded) {
      header.click()
    }
    return true
  }
  return false
}
