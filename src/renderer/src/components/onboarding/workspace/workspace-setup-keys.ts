import { isScreenSubmitShortcut } from '@/lib/screen-submit-shortcut'

export type WorkspaceSetupKeyIntent = 'continue' | 'later' | 'close' | null

export type WorkspaceSetupKeyEvent = {
  key: string
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  isComposing?: boolean
  keyCode?: number
}

export type WorkspaceSetupKeyTarget = {
  /** Focus is in a text field: its own Enter (a token's Save) must win. */
  editable: boolean
  /** Focus is on a button, link or option: Enter presses that, not Continue. */
  activatable: boolean
  /** A menu or select list is open: Escape closes it first. */
  popupOpen: boolean
}

/**
 * Enter and Cmd/Ctrl+Enter continue. Escape is Set up later on a first run; in a setup reopened
 * from Help it closes the dialog, as it does any other. Typing and open menus come first.
 */
export function workspaceSetupKeyIntent(
  event: WorkspaceSetupKeyEvent,
  target: WorkspaceSetupKeyTarget,
  options: { reopened?: boolean } = {}
): WorkspaceSetupKeyIntent {
  if (event.isComposing || event.keyCode === 229) {
    return null
  }
  if (event.key === 'Escape') {
    const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    if (modified || target.popupOpen) {
      return null
    }
    return options.reopened ? 'close' : 'later'
  }
  if (event.key !== 'Enter' || target.editable || target.popupOpen) {
    return null
  }
  if (isScreenSubmitShortcut(event)) {
    return 'continue'
  }
  const plain = !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
  return plain && !target.activatable ? 'continue' : null
}

export function describeKeyTarget(target: EventTarget | null): WorkspaceSetupKeyTarget {
  const element = target instanceof HTMLElement ? target : null
  const editable =
    element !== null &&
    (element.isContentEditable || element.closest('input, textarea, select') !== null)
  const activatable =
    element !== null &&
    element.closest('button, a[href], [role="button"], [role="option"], [role="radio"]') !== null
  return { editable, activatable, popupOpen: setupPopupOpen() }
}

/**
 * A menu or select list the dialog opened: in the dialog, or portalled over it. The app behind the
 * dialog does not count. Its workspace sidebar is a listbox too, and counting it switched Enter and
 * Escape off for everyone who already had a workspace.
 */
function setupPopupOpen(): boolean {
  const candidates = document.querySelectorAll(
    '[data-radix-popper-content-wrapper], [role="listbox"]'
  )
  return [...candidates].some((element) => element.closest('#root') === null)
}
