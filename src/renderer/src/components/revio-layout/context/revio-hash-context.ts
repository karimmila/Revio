import type { GitHubWorkItem } from '../../../../../shared/github/work-item-types'

export const REVIO_HASH_CONTEXT_EVENT = 'orca:revio-hash-context'

/** A `#` typed at the start of a word in the chat input asks for PR or issue context. */
export function typedHashStartsWord(event: KeyboardEvent, input: HTMLElement): boolean {
  if (event.key !== '#' || event.metaKey || event.ctrlKey || event.altKey) {
    return false
  }
  const selection = input.ownerDocument.getSelection()
  const node = selection?.anchorNode
  if (!selection || !node || !input.contains(node)) {
    return false
  }
  const before =
    node.nodeType === Node.TEXT_NODE
      ? (node.textContent ?? '').slice(0, selection.anchorOffset)
      : ''
  return before === '' || /\s$/.test(before)
}

/** The words a picked PR or issue leaves in the prompt: enough for an agent to look it up. */
export function workItemContextText(
  item: Pick<GitHubWorkItem, 'type' | 'number' | 'title' | 'url'>
): string {
  const kind = item.type === 'pr' ? 'PR' : 'Issue'
  return `${kind} #${item.number} "${item.title}" (${item.url}) `
}

/** Replaces the `#` before the caret with the item's context. */
export function insertWorkItemContext(
  input: HTMLElement,
  item: Pick<GitHubWorkItem, 'type' | 'number' | 'title' | 'url'>
): boolean {
  if (!input.isConnected) {
    return false
  }
  input.focus()
  const selection = input.ownerDocument.getSelection()
  const node = selection?.anchorNode
  const before =
    node && node.nodeType === Node.TEXT_NODE && selection
      ? (node.textContent ?? '').slice(0, selection.anchorOffset)
      : ''
  if (selection && before.endsWith('#')) {
    selection.modify('extend', 'backward', 'character')
  }
  return input.ownerDocument.execCommand('insertText', false, workItemContextText(item))
}
