import { describe, expect, it } from 'vitest'
import { collapseBelow, nextPanelState } from './narrow-window-panels'

const both = { left: true, right: true }
const none = { left: false, right: false }
const SIDEBAR = 280
const limits = collapseBelow(SIDEBAR)

describe('nextPanelState', () => {
  it('closes the right panel first, then the left, as the window narrows', () => {
    expect(nextPanelState(limits.right - 1, both, none, SIDEBAR).open).toEqual({
      left: true,
      right: false
    })
    expect(nextPanelState(limits.left - 1, both, none, SIDEBAR).open).toEqual(none)
  })

  it('closes the right panel at 760 px beside the default sidebar, and keeps it at 1100', () => {
    expect(nextPanelState(760, both, none, SIDEBAR).open).toEqual({ left: true, right: false })
    expect(nextPanelState(1100, both, none, SIDEBAR).open).toEqual(both)
  })

  it('moves the limits with the sidebar width', () => {
    expect(nextPanelState(1000, both, none, 420).open.right).toBe(false)
    expect(nextPanelState(1000, both, none, 240).open.right).toBe(true)
  })

  it('keeps the right panel when the person closed the left sidebar themselves', () => {
    const leftClosed = { left: false, right: true }
    expect(nextPanelState(760, leftClosed, none, SIDEBAR).open).toEqual(leftClosed)
  })

  it('reopens only what it closed, and only once clearly wider again', () => {
    const narrow = nextPanelState(500, { left: true, right: false }, none, SIDEBAR)
    expect(narrow.collapsed).toEqual({ left: true, right: false })
    expect(nextPanelState(limits.left + 10, narrow.open, narrow.collapsed, SIDEBAR).open.left).toBe(
      false
    )
    const wide = nextPanelState(1200, narrow.open, narrow.collapsed, SIDEBAR)
    expect(wide.open).toEqual({ left: true, right: false })
    expect(wide.collapsed).toEqual(none)
  })

  it('counts a sidebar it closed itself when it decides to reopen the right panel', () => {
    const narrow = nextPanelState(500, both, none, SIDEBAR)
    expect(narrow.open).toEqual(none)
    // 700 fits two columns, but the sidebar returns too and then the right panel does not fit.
    expect(nextPanelState(700, narrow.open, narrow.collapsed, SIDEBAR).open).toEqual({
      left: true,
      right: false
    })
    expect(nextPanelState(1200, narrow.open, narrow.collapsed, SIDEBAR).open).toEqual(both)
  })

  it('leaves a wide window alone', () => {
    expect(nextPanelState(1400, both, none, SIDEBAR)).toEqual({ open: both, collapsed: none })
  })
})
