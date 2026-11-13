// Read at event time from the root element (set by useRevioRootAttribute), so composer
// handlers need no store import.

/** ⌘Enter sends and Enter makes a new line ("Send messages with: ⌘ Enter"). */
export function revioSendsWithModEnter(): boolean {
  return document.documentElement.dataset.revioSendModEnter === 'true'
}

/** Long pasted text stays in the draft instead of becoming an attachment. */
export function revioKeepsLongPasteInline(): boolean {
  return document.documentElement.dataset.revioPasteInline === 'true'
}

/** The workspace layout is on (set on the root by useRevioRootAttribute). */
export function revioLayoutActive(): boolean {
  return document.documentElement.dataset.revioLayout === 'true'
}
