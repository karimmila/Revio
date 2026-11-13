import { composerSurfaceFor } from '@/components/native-chat/native-chat-composer-surface-registry'

/** `/ultracode` ("Enable Ultracode"): Claude's effort goes to Ultracode, sending nothing. */
export function runUltracodeCommand(
  event: KeyboardEvent,
  composer: HTMLElement,
  input: HTMLElement
): boolean {
  if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
    return false
  }
  if (input.textContent?.trim() !== '/ultracode') {
    return false
  }
  const registered = composerSurfaceFor(composer)
  const effort = registered?.snapshot().find((entry) => entry.id === 'effort')
  if (
    !registered ||
    !effort?.settable ||
    effort.kind.type !== 'select' ||
    !effort.kind.choices.some((choice) => choice.value === 'ultracode')
  ) {
    return false
  }
  event.preventDefault()
  void registered.surface.setOption('effort', 'ultracode')
  input.focus()
  input.ownerDocument.execCommand('selectAll')
  input.ownerDocument.execCommand('delete')
  return true
}
