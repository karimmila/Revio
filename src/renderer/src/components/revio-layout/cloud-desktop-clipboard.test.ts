import { describe, expect, it } from 'vitest'
import {
  CLOUD_DESKTOP_CLIPBOARD_MAX_BYTES,
  commandChordForDesktop,
  decideDesktopCopy,
  macTextForDesktop
} from './cloud-desktop-clipboard'

const open = { interactive: true, focused: true }

describe('decideDesktopCopy', () => {
  it('accepts text copied in the open, focused desktop', () => {
    expect(decideDesktopCopy('hello', open)).toBe('accept')
  })

  it('ignores copies from the preview or an unfocused view', () => {
    expect(decideDesktopCopy('hello', { interactive: false, focused: true })).toBe('ignore')
    expect(decideDesktopCopy('hello', { interactive: true, focused: false })).toBe('ignore')
  })

  it('ignores empty or non-text payloads', () => {
    expect(decideDesktopCopy('', open)).toBe('ignore')
    expect(decideDesktopCopy(42, open)).toBe('ignore')
  })

  it('refuses a copy over 1 MB of UTF-8', () => {
    expect(decideDesktopCopy('a'.repeat(CLOUD_DESKTOP_CLIPBOARD_MAX_BYTES), open)).toBe('accept')
    expect(decideDesktopCopy('a'.repeat(CLOUD_DESKTOP_CLIPBOARD_MAX_BYTES + 1), open)).toBe(
      'too-large'
    )
    expect(decideDesktopCopy('é'.repeat(CLOUD_DESKTOP_CLIPBOARD_MAX_BYTES / 2 + 1), open)).toBe(
      'too-large'
    )
  })
})

describe('macTextForDesktop', () => {
  it('sends new Mac text once', () => {
    expect(macTextForDesktop('abc', null)).toBe('abc')
    expect(macTextForDesktop('abc', 'abc')).toBeNull()
  })

  it('sends nothing for an empty or oversized clipboard', () => {
    expect(macTextForDesktop('', null)).toBeNull()
    expect(macTextForDesktop('a'.repeat(CLOUD_DESKTOP_CLIPBOARD_MAX_BYTES + 1), null)).toBeNull()
  })
})

describe('commandChordForDesktop', () => {
  const key = (k: string, mods: Partial<Record<'meta' | 'ctrl' | 'alt' | 'shift', boolean>>) => ({
    key: k,
    metaKey: mods.meta ?? false,
    ctrlKey: mods.ctrl ?? false,
    altKey: mods.alt ?? false,
    shiftKey: mods.shift ?? false
  })

  it('maps ⌘C, ⌘V and ⌘X to Ctrl chords', () => {
    expect(commandChordForDesktop(key('c', { meta: true }))).toEqual({
      modifier: 0xffe3,
      key: 0x63,
      paste: false
    })
    expect(commandChordForDesktop(key('V', { meta: true }))?.paste).toBe(true)
    expect(commandChordForDesktop(key('x', { meta: true }))?.key).toBe(0x78)
  })

  it('leaves other keys and modifier mixes alone', () => {
    expect(commandChordForDesktop(key('c', {}))).toBeNull()
    expect(commandChordForDesktop(key('q', { meta: true }))).toBeNull()
    expect(commandChordForDesktop(key('v', { meta: true, shift: true }))).toBeNull()
  })
})
