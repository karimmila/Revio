import React from 'react'
import { translate } from '@/i18n/i18n'
import {
  useConfirmationDialog,
  type ConfirmationDialogContextValue,
  type ConfirmationDialogOptions
} from '@/components/confirmation-dialog-context'
import { revioLayoutActive } from './revio-root-flags'

let confirm: ConfirmationDialogContextValue | null = null

/** Lends the app's confirmation dialog to terminal code that renders outside React. */
export function RevioTerminalLinkConfirmBridge(): null {
  const dialog = useConfirmationDialog()
  React.useEffect(() => {
    confirm = dialog
    return () => {
      if (confirm === dialog) {
        confirm = null
      }
    }
  }, [dialog])
  return null
}

/** Whether a ⌘-clicked terminal hyperlink must be confirmed first ("Open link?"). */
export function terminalLinkNeedsConfirm(): boolean {
  return revioLayoutActive() && confirm !== null
}

/**
 * The workspace layout asks before opening an OSC 8 hyperlink, whose visible text can differ from
 * where it goes: "Open this terminal link?" with the full URL.
 */
export async function confirmTerminalLink(url: string): Promise<boolean> {
  if (!confirm) {
    return true
  }
  return confirm({
    title: translate('auto.components.revioLayout.openLinkTitle', 'Open link?'),
    description: translate(
      'auto.components.revioLayout.openLinkDescription',
      'Open this terminal link?\n\n{{value0}}',
      { value0: url }
    ),
    descriptionClassName: 'whitespace-pre-wrap break-all',
    confirmLabel: translate('auto.components.revioLayout.openLinkConfirm', 'Open'),
    cancelLabel: translate('auto.components.revioLayout.openLinkCancel', 'Cancel')
  })
}

/**
 * The app's confirmation dialog for code outside React that must not act unasked (a link that
 * saves something, a repository's command). With no dialog to show, the answer is no.
 */
export async function confirmWithAppDialog(options: ConfirmationDialogOptions): Promise<boolean> {
  return confirm ? confirm(options) : false
}
