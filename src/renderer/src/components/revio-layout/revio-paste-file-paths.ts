/** Paths as one line of prompt text; a path with whitespace is quoted so it stays one argument. */
export function copiedFilePathsText(paths: readonly string[]): string {
  return paths.map((path) => (/\s/.test(path) ? `"${path}"` : path)).join(' ')
}

/**
 * ⌘⇧V "Paste copied files as paths": files copied in Finder go into the chat input as
 * their paths, where a plain paste would attach them. Clipboard text without files is left alone.
 */
export async function pasteCopiedFilePaths(input: HTMLElement): Promise<boolean> {
  const paths = await window.api.ui.readClipboardFilePaths().catch(() => [])
  if (paths.length === 0) {
    return false
  }
  input.focus()
  // The composer's editor reads typed text from the DOM, as for any other insertion.
  return input.ownerDocument.execCommand('insertText', false, copiedFilePathsText(paths))
}
