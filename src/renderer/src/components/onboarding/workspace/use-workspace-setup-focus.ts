import { useEffect, type RefObject } from 'react'

// Menus, selects and app dialogs a step opens are portalled outside the setup dialog; focus there is theirs.
const PORTALLED_OWNERS =
  '[data-radix-popper-content-wrapper], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'

/** True when focus sits on the page behind the setup dialog, or on nothing at all. */
export function setupFocusEscaped(active: Element | null, dialog: HTMLElement): boolean {
  if (active === null || active === document.body) {
    return true
  }
  if (dialog.contains(active)) {
    return false
  }
  return active.closest(PORTALLED_OWNERS) === null
}

/**
 * Keeps keyboard focus in the setup dialog: the step heading takes it on open and on each step, and
 * focus that lands behind the overlay (the Help menu hands it back to its own button) comes back.
 */
export function useWorkspaceSetupFocus(args: {
  dialogRef: RefObject<HTMLElement | null>
  headingRef: RefObject<HTMLElement | null>
  stepKey: string
  suspended: boolean
}): void {
  const { dialogRef, headingRef, stepKey, suspended } = args

  useEffect(() => {
    if (!suspended) {
      headingRef.current?.focus({ preventScroll: true })
    }
  }, [headingRef, stepKey, suspended])

  useEffect(() => {
    if (suspended) {
      return
    }
    const reclaim = (): void => {
      const dialog = dialogRef.current
      if (dialog && setupFocusEscaped(document.activeElement, dialog)) {
        dialog.focus({ preventScroll: true })
      }
    }
    let frame = 0
    // A blur to nothing (a click on empty space) only shows on <body> after the event settles.
    const onFocusOut = (event: FocusEvent): void => {
      if (event.relatedTarget === null) {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(reclaim)
      }
    }
    document.addEventListener('focusin', reclaim)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('focusin', reclaim)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [dialogRef, suspended])
}
