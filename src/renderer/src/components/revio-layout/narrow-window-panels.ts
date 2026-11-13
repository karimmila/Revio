import React from 'react'
import { useAppStore } from '@/store'

/**
 * The right panel shares the space beside the left sidebar with the center pane. Under
 * MIN_SPLIT_WIDTH (CSS px) neither fits its content: the right panel's tabs clip and the composer
 * wraps. So the right panel goes first, then the left once the center alone is too narrow. Both
 * limits follow the sidebar's own width, which the person can drag.
 * Each panel comes back a little wider than it left, so a window resized around the edge does not
 * flicker.
 */
export const MIN_SPLIT_WIDTH = 680
export const MIN_CENTER_WIDTH = 280
const RESTORE_MARGIN = 40

/** Window widths below which each panel closes, for a left sidebar that takes `leftWidth`. */
export function collapseBelow(leftWidth: number): { left: number; right: number } {
  return { left: leftWidth + MIN_CENTER_WIDTH, right: leftWidth + MIN_SPLIT_WIDTH }
}

export type PanelState = { left: boolean; right: boolean }

/** Panels this module closed and must reopen; a panel the person reopened themselves is dropped. */
export type AutoCollapsed = PanelState

export function nextPanelState(
  width: number,
  open: PanelState,
  collapsed: AutoCollapsed,
  sidebarWidth: number
): { open: PanelState; collapsed: AutoCollapsed } {
  const next = { open: { ...open }, collapsed: { ...collapsed } }
  // A sidebar the person closed themselves leaves its space to the other two columns for good.
  const leftSpace = open.left || collapsed.left ? sidebarWidth : 0
  const limits = { left: collapseBelow(sidebarWidth).left, right: collapseBelow(leftSpace).right }
  for (const side of ['right', 'left'] as const) {
    const below = limits[side]
    if (width < below && open[side]) {
      next.open[side] = false
      next.collapsed[side] = true
    } else if (width >= below + RESTORE_MARGIN && collapsed[side] && !open[side]) {
      next.open[side] = true
      next.collapsed[side] = false
    }
  }
  return next
}

/** Keeps the center pane usable in a narrow window by closing side panels, and reopens them after. */
export function useNarrowWindowPanels(): void {
  React.useEffect(() => {
    let collapsed: AutoCollapsed = { left: false, right: false }
    const apply = (): void => {
      const state = useAppStore.getState()
      const open = { left: state.sidebarOpen, right: state.rightSidebarOpen }
      const next = nextPanelState(window.innerWidth, open, collapsed, state.sidebarWidth)
      collapsed = next.collapsed
      if (next.open.left !== open.left) {
        state.setSidebarOpen(next.open.left)
      }
      if (next.open.right !== open.right) {
        state.setRightSidebarOpen(next.open.right)
      }
    }
    // Reopening a panel by hand while narrow is a choice; stop treating it as ours to close again.
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (state.sidebarOpen && !previous.sidebarOpen) {
        collapsed = { ...collapsed, left: false }
      }
      if (state.rightSidebarOpen && !previous.rightSidebarOpen) {
        collapsed = { ...collapsed, right: false }
      }
    })
    apply()
    window.addEventListener('resize', apply)
    return () => {
      window.removeEventListener('resize', apply)
      unsubscribe()
    }
  }, [])
}
