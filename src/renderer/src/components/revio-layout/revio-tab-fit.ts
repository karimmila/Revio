/** One tab's extent inside the strip's scrolled content, in CSS px. */
export type TabExtent = { start: number; end: number }

export type TabStripView = {
  scrollLeft: number
  /** Visible width of the strip. */
  width: number
  /** Width each chevron covers when it shows. */
  chevron: { left: number; right: number }
  edges: { left: boolean; right: boolean }
}

const SLACK = 1

function visibleRange(view: TabStripView): TabExtent {
  return {
    start: view.scrollLeft + (view.edges.left ? view.chevron.left : 0),
    end: view.scrollLeft + view.width - (view.edges.right ? view.chevron.right : 0)
  }
}

/**
 * Which tabs show in full. A tab cut by the strip's edge is hidden whole instead, so no label ends
 * mid-word; the chevron brings it in. When not even one fits, the first tab in view stays, cut, so
 * the strip is never empty.
 */
export function wholeTabs(tabs: readonly TabExtent[], view: TabStripView): boolean[] {
  const range = visibleRange(view)
  const whole = tabs.map((tab) => tab.start >= range.start - SLACK && tab.end <= range.end + SLACK)
  if (!whole.includes(true)) {
    const firstInView = tabs.findIndex((tab) => tab.end > range.start)
    if (firstInView !== -1) {
      whole[firstInView] = true
    }
  }
  return whole
}

/**
 * Where a chevron scrolls to: the tab next to the ones showing, with its start at the left edge.
 * Stepping from what shows, not from what is cut, also moves on from a tab too wide to show whole.
 */
export function chevronScrollLeft(
  tabs: readonly TabExtent[],
  view: TabStripView,
  direction: 1 | -1
): number {
  const shown = wholeTabs(tabs, view)
  const index = direction === 1 ? shown.lastIndexOf(true) + 1 : shown.indexOf(true) - 1
  const target = index >= 0 ? tabs[index] : undefined
  // The left chevron shows once the strip has scrolled, so leave its width free.
  return target ? Math.max(0, target.start - view.chevron.left) : view.scrollLeft
}
