/** Asks the snippet dialog to open for this chat input. */
export const REVIO_INSERT_SNIPPET_EVENT = 'orca:revio-insert-snippet'

export function requestSnippetInsert(input: HTMLElement): void {
  window.dispatchEvent(new CustomEvent(REVIO_INSERT_SNIPPET_EVENT, { detail: input }))
}

/** Types the snippet at the input's caret, as typing would. */
export function insertIntoChatInput(input: HTMLElement, text: string): boolean {
  if (!input.isConnected) {
    return false
  }
  input.focus()
  return input.ownerDocument.execCommand('insertText', false, text)
}
