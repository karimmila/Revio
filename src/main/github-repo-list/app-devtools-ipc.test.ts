import { describe, expect, it } from 'vitest'
import { isAppDevToolsAllowed } from './app-devtools-ipc'

describe('Help > Open debug tools', () => {
  it('is always allowed in dev builds', () => {
    expect(isAppDevToolsAllowed({ isPackaged: () => false, debugToolsEnabled: () => false })).toBe(
      true
    )
  })

  it('is off in packaged builds until the Advanced setting turns it on', () => {
    expect(isAppDevToolsAllowed({ isPackaged: () => true, debugToolsEnabled: () => false })).toBe(
      false
    )
    expect(isAppDevToolsAllowed({ isPackaged: () => true, debugToolsEnabled: () => true })).toBe(
      true
    )
  })
})
