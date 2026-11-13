import { describe, expect, it } from 'vitest'
import { isRoutineSaveKey } from './automation-editor-save-key'

const key = (mods: Partial<KeyboardEvent>) => ({
  key: 's',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods
})

describe('isRoutineSaveKey', () => {
  it('takes ⌘S on macOS and Ctrl+S elsewhere', () => {
    expect(isRoutineSaveKey(key({ metaKey: true }), true)).toBe(true)
    expect(isRoutineSaveKey(key({ ctrlKey: true }), true)).toBe(false)
    expect(isRoutineSaveKey(key({ ctrlKey: true }), false)).toBe(true)
  })

  it('ignores ⌘⇧S and other keys', () => {
    expect(isRoutineSaveKey(key({ metaKey: true, shiftKey: true }), true)).toBe(false)
    expect(isRoutineSaveKey({ ...key({ metaKey: true }), key: 'a' }, true)).toBe(false)
  })
})
