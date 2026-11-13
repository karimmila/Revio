import { describe, expect, it } from 'vitest'
import { chevronScrollLeft, wholeTabs, type TabStripView } from './revio-tab-fit'

// "All files", "Changes", "Checks" at their measured widths.
const tabs = [
  { start: 0, end: 62 },
  { start: 62, end: 132 },
  { start: 132, end: 190 }
]

function view(scrollLeft: number, width: number): TabStripView {
  return {
    scrollLeft,
    width,
    chevron: { left: 24, right: 32 },
    edges: { left: scrollLeft > 1, right: scrollLeft + width < 190 - 1 }
  }
}

describe('wholeTabs', () => {
  it('shows every tab when the strip is wide enough', () => {
    expect(wholeTabs(tabs, view(0, 190))).toEqual([true, true, true])
  })

  it('hides a tab the edge would cut instead of showing half its label', () => {
    // The 760 px window: 120 px of strip showed "All files" and "C".
    expect(wholeTabs(tabs, view(0, 120))).toEqual([true, false, false])
  })

  it('hides a tab under the left chevron once the strip has scrolled', () => {
    expect(wholeTabs(tabs, view(38, 126))).toEqual([false, true, false])
  })

  it('keeps the first tab in view when none fits, so the strip is never empty', () => {
    expect(wholeTabs(tabs, view(0, 60))).toEqual([true, false, false])
  })
})

describe('chevronScrollLeft', () => {
  it('brings the next hidden tab in full to the left edge, past the chevron', () => {
    const next = chevronScrollLeft(tabs, view(0, 120), 1)
    expect(next).toBe(38)
    expect(wholeTabs(tabs, view(next, 126))[1]).toBe(true)
  })

  it('brings the previous hidden tab back in full', () => {
    const back = chevronScrollLeft(tabs, view(60, 130), -1)
    expect(wholeTabs(tabs, view(back, 130))).toEqual([false, true, false])
    expect(chevronScrollLeft(tabs, view(back, 130), -1)).toBe(0)
  })

  it('moves on from a tab too wide to show whole between the chevrons', () => {
    // 99 px: "Changes" shows cut after one step, and the next step must still reach "Checks".
    const first = chevronScrollLeft(tabs, view(0, 99), 1)
    expect(wholeTabs(tabs, view(first, 99))).toEqual([false, true, false])
    const second = Math.min(chevronScrollLeft(tabs, view(first, 99), 1), 190 - 99)
    expect(second).toBeGreaterThan(first)
    expect(wholeTabs(tabs, view(second, 99))).toEqual([false, false, true])
    expect(chevronScrollLeft(tabs, view(second, 99), -1)).toBe(first)
  })

  it('stays put when nothing is hidden that way', () => {
    expect(chevronScrollLeft(tabs, view(0, 190), 1)).toBe(0)
    expect(chevronScrollLeft(tabs, view(0, 120), -1)).toBe(0)
  })
})
