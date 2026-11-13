import { describe, expect, it } from 'vitest'
import { revioAppKeyFor, nextZenLayout, toggledTheme } from './revio-app-keys'

const key = (code: string, mods: { alt?: boolean; shift?: boolean; ctrl?: boolean } = {}) => ({
  code,
  metaKey: true,
  altKey: mods.alt === true,
  shiftKey: mods.shift === true,
  ctrlKey: mods.ctrl === true
})

describe('App keys', () => {
  it("maps the layout's chords", () => {
    expect(revioAppKeyFor(key('Slash', { alt: true }))).toBe('openKeyboardShortcuts')
    expect(revioAppKeyFor(key('KeyH', { shift: true }))).toBe('home')
    expect(revioAppKeyFor(key('KeyT', { alt: true }))).toBe('toggleTheme')
    expect(revioAppKeyFor(key('KeyA', { alt: true }))).toBe('addRepository')
    expect(revioAppKeyFor(key('KeyF', { alt: true }))).toBe('sendFeedback')
    expect(revioAppKeyFor(key('Period'))).toBe('toggleZenMode')
    expect(revioAppKeyFor(key('KeyN', { shift: true }))).toBe('createFrom')
    expect(revioAppKeyFor(key('KeyD'))).toBe('splitTab')
  })

  it('ignores other modifiers and plain keys', () => {
    expect(revioAppKeyFor(key('KeyH'))).toBeNull()
    expect(revioAppKeyFor(key('Period', { ctrl: true }))).toBeNull()
    expect(revioAppKeyFor({ ...key('KeyH', { shift: true }), metaKey: false })).toBeNull()
  })

  it('flips the theme on screen', () => {
    expect(toggledTheme('dark', false)).toBe('light')
    expect(toggledTheme('light', true)).toBe('dark')
    expect(toggledTheme('system', true)).toBe('light')
    expect(toggledTheme('system', false)).toBe('dark')
  })

  it('hides both sidebars, then restores what was open', () => {
    const hidden = nextZenLayout({ left: true, right: false }, null)
    expect(hidden).toEqual({
      next: { left: false, right: false },
      saved: { left: true, right: false }
    })
    expect(nextZenLayout(hidden.next, hidden.saved)).toEqual({
      next: { left: true, right: false },
      saved: null
    })
    expect(nextZenLayout({ left: false, right: false }, null).next).toEqual({
      left: true,
      right: true
    })
  })
})
