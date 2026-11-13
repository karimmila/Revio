import { describe, expect, it } from 'vitest'
import { MAC_OPEN_IN_APPS, macOpenInCommand } from './open-in-mac-apps'

describe('macOS Open in apps', () => {
  it('opens an app by name with open -a', () => {
    expect(macOpenInCommand('GitHub Desktop')).toBe('open -a "GitHub Desktop"')
  })

  it('drops characters that could break out of the quotes', () => {
    expect(macOpenInCommand('A"; rm -rf $HOME`')).toBe('open -a "A; rm -rf HOME"')
  })

  it("covers the layout's list with unique ids", () => {
    const ids = MAC_OPEN_IN_APPS.map((app) => app.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(['xcode', 'ghostty', 'iterm', 'warp', 'fork']))
  })
})
