/**
 * Clipboard rules between this Mac and a cloud workspace's desktop (VNC). The desktop can only
 * reach the Mac clipboard while the user works in the open, focused desktop view, and only with
 * text; the Mac clipboard goes to the desktop only on the user's paste or focus there. Must stay
 * in step with Xvnc's -MaxCutText in src/main/cloud/cloud-desktop.ts.
 */
export const CLOUD_DESKTOP_CLIPBOARD_MAX_BYTES = 1024 * 1024

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).byteLength
}

export type DesktopCopyVerdict = 'accept' | 'ignore' | 'too-large'

/** A copy made inside the desktop (RFB server cut text) and whether it may reach the Mac. */
export function decideDesktopCopy(
  text: unknown,
  view: { interactive: boolean; focused: boolean }
): DesktopCopyVerdict {
  if (typeof text !== 'string' || text === '' || !view.interactive || !view.focused) {
    return 'ignore'
  }
  return utf8Length(text) > CLOUD_DESKTOP_CLIPBOARD_MAX_BYTES ? 'too-large' : 'accept'
}

/** The Mac text to hand the desktop, or null when there is nothing new or it is too large. */
export function macTextForDesktop(text: string, lastSent: string | null): string | null {
  if (text === '' || text === lastSent || utf8Length(text) > CLOUD_DESKTOP_CLIPBOARD_MAX_BYTES) {
    return null
  }
  return text
}

const XK_CONTROL_L = 0xffe3

// ⌘ shortcuts a Mac user reaches for, sent to the desktop as Ctrl, as Linux apps expect.
const COMMAND_KEYS: Readonly<Record<string, number>> = {
  a: 0x61,
  c: 0x63,
  v: 0x76,
  x: 0x78,
  z: 0x7a
}

export type DesktopKeyChord = { modifier: number; key: number; paste: boolean }

/** ⌘C, ⌘V, ⌘X, ⌘A and ⌘Z as the desktop's Ctrl chords; null for any other key. */
export function commandChordForDesktop(event: {
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  key: string
}): DesktopKeyChord | null {
  if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return null
  }
  const key = COMMAND_KEYS[event.key.toLowerCase()]
  return key === undefined ? null : { modifier: XK_CONTROL_L, key, paste: key === 0x76 }
}
