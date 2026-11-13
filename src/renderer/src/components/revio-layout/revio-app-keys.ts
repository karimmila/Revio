/**
 * The app and navigation keys that Orca has no keybinding action for (its 0.92 registry).
 * Orca's own actions keep their chords through the keymap; these act on the layout.
 */
export type RevioAppKey =
  | 'openKeyboardShortcuts'
  | 'home'
  | 'toggleTheme'
  | 'addRepository'
  | 'sendFeedback'
  | 'toggleZenMode'
  | 'createFrom'
  | 'splitTab'

type KeyLike = Pick<KeyboardEvent, 'code' | 'metaKey' | 'altKey' | 'shiftKey' | 'ctrlKey'>

const KEYS: readonly { code: string; alt: boolean; shift: boolean; action: RevioAppKey }[] = [
  { code: 'Slash', alt: true, shift: false, action: 'openKeyboardShortcuts' },
  { code: 'KeyH', alt: false, shift: true, action: 'home' },
  { code: 'KeyT', alt: true, shift: false, action: 'toggleTheme' },
  { code: 'KeyA', alt: true, shift: false, action: 'addRepository' },
  { code: 'KeyF', alt: true, shift: false, action: 'sendFeedback' },
  { code: 'Period', alt: false, shift: false, action: 'toggleZenMode' },
  { code: 'KeyN', alt: false, shift: true, action: 'createFrom' },
  { code: 'KeyD', alt: false, shift: false, action: 'splitTab' }
]

export function revioAppKeyFor(event: KeyLike): RevioAppKey | null {
  if (!event.metaKey || event.ctrlKey) {
    return null
  }
  return (
    KEYS.find(
      (key) => key.code === event.code && key.alt === event.altKey && key.shift === event.shiftKey
    )?.action ?? null
  )
}

/** ⌘⌥T flips what is on screen, so "system" becomes the opposite of the OS's current look. */
export function toggledTheme(
  theme: 'system' | 'dark' | 'light',
  systemPrefersDark: boolean
): 'dark' | 'light' {
  const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark)
  return dark ? 'light' : 'dark'
}

export type SidebarPair = { left: boolean; right: boolean }

/**
 * Zen mode hides both sidebars and remembers what was open, so the second ⌘. restores it. A
 * layout already without sidebars has nothing to hide, so ⌘. opens both.
 */
export function nextZenLayout(
  current: SidebarPair,
  saved: SidebarPair | null
): { next: SidebarPair; saved: SidebarPair | null } {
  if (current.left || current.right) {
    return { next: { left: false, right: false }, saved: current }
  }
  return { next: saved ?? { left: true, right: true }, saved: null }
}

export const REVIO_SEND_FEEDBACK_EVENT = 'orca:revio-send-feedback'
