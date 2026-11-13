import type { RevioPromptSnippet } from '../../../../../shared/revio-prompt-snippets'

/** The `;keyword` just typed before the caret, when it names a snippet. */
export function snippetForTypedKeyword(
  textBeforeCaret: string,
  snippets: readonly RevioPromptSnippet[]
): { snippet: RevioPromptSnippet; typedLength: number } | null {
  const match = /(?:^|\s);([^\s;]+)$/.exec(textBeforeCaret)
  if (!match) {
    return null
  }
  const keyword = match[1]
  const snippet = snippets.find((entry) => entry.keyword && entry.keyword === keyword)
  return snippet ? { snippet, typedLength: keyword.length + 1 } : null
}

/**
 * `;keyword`: Tab or Space right after a snippet's keyword in the chat input replaces
 * the keyword with the snippet. Returns true when it did.
 */
export function expandSnippetKeyword(
  event: KeyboardEvent,
  input: HTMLElement,
  snippets: readonly RevioPromptSnippet[]
): boolean {
  if ((event.key !== 'Tab' && event.key !== ' ') || event.shiftKey || event.metaKey) {
    return false
  }
  const selection = input.ownerDocument.getSelection()
  const node = selection?.anchorNode
  if (!selection || !selection.isCollapsed || !node || !input.contains(node)) {
    return false
  }
  const before =
    node.nodeType === Node.TEXT_NODE
      ? (node.textContent ?? '').slice(0, selection.anchorOffset)
      : ''
  const found = snippetForTypedKeyword(before, snippets)
  if (!found) {
    return false
  }
  event.preventDefault()
  for (let index = 0; index < found.typedLength; index++) {
    selection.modify('extend', 'backward', 'character')
  }
  input.ownerDocument.execCommand('insertText', false, found.snippet.body)
  return true
}
