/**
 * The terminal text is about 13.4pt on screen, which is 11px at Orca's 120% zoom against
 * Orca's 14px default. The workspace layout scales the user's size by that ratio, so a larger or
 * smaller preference still carries through.
 */
const REVIO_TERMINAL_SCALE = 11 / 14

export function effectiveTerminalFontSize(
  settings: { terminalFontSize?: number; revioLayout?: boolean } | null | undefined
): number {
  const size = settings?.terminalFontSize ?? 14
  return settings?.revioLayout === true
    ? Math.max(8, Math.round(size * REVIO_TERMINAL_SCALE))
    : size
}
