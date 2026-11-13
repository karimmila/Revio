// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { orderDockTabs } from './revio-dock-order'

describe('orderDockTabs', () => {
  it('lists Setup, then Run, then the terminals in their own order', () => {
    const tabs = ['Terminal 1', 'Run', 'Terminal 2', 'Setup', null]
    expect(orderDockTabs(tabs, (title) => title)).toEqual([
      'Setup',
      'Run',
      'Terminal 1',
      'Terminal 2',
      null
    ])
  })
})
