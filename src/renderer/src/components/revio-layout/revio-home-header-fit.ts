import React from 'react'

/**
 * How much the Home header shows, richest first. The header steps down one level at a time
 * until its controls fit its own width, so nothing is cut at any window or sidebar width.
 */
export const REVIO_HOME_HEADER_LEVELS = [
  /** Every menu with its label. */
  'labels',
  /** The filter and sort menus keep their label; the others are icons. */
  'main-labels',
  /** Every control is its icon. */
  'icons',
  /** The menus are one "more" menu beside the search field and Create. */
  'menu'
] as const

export type RevioHomeHeaderLevel = (typeof REVIO_HOME_HEADER_LEVELS)[number]

/**
 * The richest level at which `element`'s content fits its width. It is measured, not computed
 * from the window: the header's width is the window less the sidebar, and its labels change
 * with the language and the selected project.
 *
 * A change of width or of `contentKey` starts again from the richest level; each render then
 * steps one level down while the content still overflows. Layout effects run before paint, so
 * the steps in between are never seen.
 */
export function useRevioHomeHeaderLevel(
  ref: React.RefObject<HTMLElement | null>,
  contentKey: string
): RevioHomeHeaderLevel {
  // `pass` makes a new width measure again when the level is already the richest one.
  const [{ index, pass }, setFit] = React.useState({ index: 0, pass: 0 })
  const measured = React.useRef({ contentKey, width: -1 })

  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(() => {
      const width = element.clientWidth
      if (width !== measured.current.width) {
        measured.current.width = width
        setFit((fit) => ({ index: 0, pass: fit.pass + 1 }))
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    if (measured.current.contentKey !== contentKey) {
      measured.current.contentKey = contentKey
      if (index !== 0) {
        setFit((fit) => ({ index: 0, pass: fit.pass + 1 }))
        return
      }
    }
    if (index < REVIO_HOME_HEADER_LEVELS.length - 1 && element.scrollWidth > element.clientWidth) {
      setFit((fit) => ({ index: index + 1, pass: fit.pass }))
    }
  }, [contentKey, index, pass, ref])

  return REVIO_HOME_HEADER_LEVELS[index]
}
