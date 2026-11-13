type ButtonLike = { disabled: boolean; closesDialog: boolean }

/** ⌘↵ (dialog.primaryAction): the footer's last enabled button that is not Cancel. */
export function dialogPrimaryIndex(buttons: readonly ButtonLike[]): number {
  for (let index = buttons.length - 1; index >= 0; index -= 1) {
    const button = buttons[index]
    if (button && !button.disabled && !button.closesDialog) {
      return index
    }
  }
  return -1
}

/** Clicks the primary button of the open dialog's footer; false when there is none. */
export function confirmOpenDialog(): boolean {
  const dialogs = document.querySelectorAll('[data-slot="dialog-content"]')
  const dialog = [...dialogs].at(-1)
  const buttons = [
    ...(dialog?.querySelectorAll<HTMLButtonElement>('[data-slot="dialog-footer"] button') ?? [])
  ]
  const index = dialogPrimaryIndex(
    buttons.map((button) => ({
      disabled: button.disabled,
      closesDialog: button.closest('[data-slot="dialog-close"]') !== null
    }))
  )
  const primary = buttons[index]
  if (!primary) {
    return false
  }
  primary.click()
  return true
}
