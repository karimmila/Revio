type StatusBarState = {
  statusBarVisible: boolean
  settings?: { revioLayout?: boolean } | null
}

/**
 * Whether the status bar is on screen. The workspace layout never shows it, whatever an older
 * profile or the classic layout saved: the bar's usage, rate-limit and keep-awake controls belong
 * to the classic layout, and this layout has no menu item to turn it off again.
 */
export function selectStatusBarShown(state: StatusBarState): boolean {
  return state.statusBarVisible && state.settings?.revioLayout !== true
}
