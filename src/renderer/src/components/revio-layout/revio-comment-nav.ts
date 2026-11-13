import { useEffect, useRef } from 'react'
import type { editor } from 'monaco-editor'
import { COMBINED_DIFF_VIEWPORT_SELECTOR } from '@/components/editor/combined-diff/scroll-viewport/combined-diff-viewport'
import { revioLayoutActive } from './revio-root-flags'

export type CommentDirection = 'previous' | 'next'

const CARD_SELECTOR = '.orca-diff-comment-card'

/**
 * The comment to go to from `current`, given comment positions in ascending order. A comment
 * within `slack` of `current` is the one on screen, so it is skipped.
 */
export function pickComment(
  positions: readonly number[],
  current: number,
  direction: CommentDirection,
  slack = 1
): number | null {
  if (direction === 'next') {
    const index = positions.findIndex((position) => position > current + slack)
    return index === -1 ? null : index
  }
  for (let index = positions.length - 1; index >= 0; index -= 1) {
    if (positions[index] < current - slack) {
      return index
    }
  }
  return null
}

type Navigator = { node: HTMLElement; navigate: (direction: CommentDirection) => boolean }
const navigators = new Set<Navigator>()

function visible(node: HTMLElement): boolean {
  return node.isConnected && node.getClientRects().length > 0
}

/** The all-changes diff: every section is laid out at full height, so the cards are all in the DOM. */
export function navigateCombined(viewport: HTMLElement, direction: CommentDirection): boolean {
  const viewportTop = viewport.getBoundingClientRect().top
  const middle = viewport.clientHeight / 2
  const positions = [...viewport.querySelectorAll<HTMLElement>(CARD_SELECTOR)]
    .filter(visible)
    .map((card) => {
      const rect = card.getBoundingClientRect()
      return rect.top - viewportTop + rect.height / 2
    })
    .sort((a, b) => a - b)
  const index = pickComment(positions, middle, direction, 4)
  if (index === null) {
    return false
  }
  viewport.scrollTop += positions[index] - middle
  return true
}

/**
 * ⌘⌥J / ⌘⌥K: next or previous comment in the diff on screen. Returns true when the
 * key was handled.
 */
export function handleRevioCommentKey(event: KeyboardEvent): boolean {
  if (!event.metaKey || !event.altKey || event.ctrlKey || event.shiftKey) {
    return false
  }
  const direction: CommentDirection | null =
    event.code === 'KeyJ' ? 'next' : event.code === 'KeyK' ? 'previous' : null
  if (!direction) {
    return false
  }
  const viewport = document.querySelector<HTMLElement>(COMBINED_DIFF_VIEWPORT_SELECTOR)
  if (viewport && visible(viewport)) {
    navigateCombined(viewport, direction)
    return true
  }
  const shown = [...navigators].filter((entry) => visible(entry.node))
  const focused = shown.find((entry) => entry.node.contains(document.activeElement))
  const target = focused ?? shown[0]
  if (!target) {
    return false
  }
  target.navigate(direction)
  return true
}

/** Lets ⌘⌥J / ⌘⌥K reach a single-file diff's comments (Monaco scrolls it, not the page). */
export function useRevioCommentNav(
  modifiedEditor: editor.ICodeEditor | null,
  commentLines: readonly number[]
): void {
  const linesRef = useRef(commentLines)
  linesRef.current = commentLines
  useEffect(() => {
    // Classic layout never navigates comments, so it never touches the editor here.
    if (!modifiedEditor || !revioLayoutActive()) {
      return
    }
    const node = modifiedEditor.getContainerDomNode()
    if (!node) {
      return
    }
    const entry: Navigator = {
      node,
      navigate: (direction) => {
        const range = modifiedEditor.getVisibleRanges()[0]
        const middle = range
          ? Math.round((range.startLineNumber + range.endLineNumber) / 2)
          : (modifiedEditor.getPosition()?.lineNumber ?? 1)
        const lines = [...new Set(linesRef.current)].sort((a, b) => a - b)
        const index = pickComment(lines, middle, direction, 0)
        if (index === null) {
          return false
        }
        modifiedEditor.revealLineInCenter(lines[index])
        return true
      }
    }
    navigators.add(entry)
    return () => {
      navigators.delete(entry)
    }
  }, [modifiedEditor])
}

/** Comment cards wholly above and below what the all-changes diff shows. */
type Rect = { top: number; bottom: number; height: number }
type ViewportLike = {
  getBoundingClientRect: () => Rect
  querySelectorAll: (selector: string) => Iterable<{ getBoundingClientRect: () => Rect }>
}

export function commentsOutOfView(viewport: ViewportLike): { previous: number; next: number } {
  const { top, bottom } = viewport.getBoundingClientRect()
  let previous = 0
  let next = 0
  for (const card of viewport.querySelectorAll(CARD_SELECTOR)) {
    const rect = card.getBoundingClientRect()
    if (rect.height === 0) {
      continue
    }
    if (rect.bottom <= top) {
      previous += 1
    } else if (rect.top >= bottom) {
      next += 1
    }
  }
  return { previous, next }
}
