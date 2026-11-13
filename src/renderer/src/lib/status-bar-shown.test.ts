import { describe, expect, it } from 'vitest'
import { selectStatusBarShown } from './status-bar-shown'

describe('selectStatusBarShown', () => {
  it('follows the saved choice in the classic layout', () => {
    expect(selectStatusBarShown({ statusBarVisible: true, settings: { revioLayout: false } })).toBe(
      true
    )
    expect(selectStatusBarShown({ statusBarVisible: false, settings: null })).toBe(false)
    expect(selectStatusBarShown({ statusBarVisible: true })).toBe(true)
  })

  it('is never shown in the workspace layout, even when a profile saved it on', () => {
    expect(selectStatusBarShown({ statusBarVisible: true, settings: { revioLayout: true } })).toBe(
      false
    )
  })
})
