import { composerSurfaceFor } from '@/components/native-chat/native-chat-composer-surface-registry'

function visible(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && element.getBoundingClientRect().width > 0
}

function draftIsEmpty(composer: HTMLElement): boolean {
  return !composer.querySelector('[contenteditable="true"]')?.textContent?.trim()
}

/** Flips a chat option through the chat's own surface; false when the chat has no such option. */
function setOption(
  composer: HTMLElement,
  id: string,
  next: (current: unknown) => string | boolean
): boolean {
  const registered = composerSurfaceFor(composer)
  const descriptor = registered?.snapshot().find((entry) => entry.id === id)
  if (!registered || !descriptor?.settable) {
    return false
  }
  const value = next(descriptor.kind.currentValue)
  if (
    descriptor.kind.type === 'select' &&
    !descriptor.kind.choices.some((choice) => choice.value === value)
  ) {
    return false
  }
  void registered.surface.setOption(id, value)
  return true
}

/**
 * The chat mode and approval keys on the chat on screen: ⇧Tab plan mode, ⌘⇧E Fast mode,
 * and, while the agent asks for approval and the draft is empty, ↵ approve, ⌘↵ the alternate
 * approval, ⌫ deny, ⌘⇧↵ approve a plan. Returns true when the key was handled.
 */
export function handleRevioChatModeKey(event: KeyboardEvent, composer: HTMLElement): boolean {
  const inComposer = composer.contains(document.activeElement)
  if (event.key === 'Tab' && event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
    return (
      inComposer &&
      setOption(composer, 'interactionMode', (current) => (current === 'plan' ? 'default' : 'plan'))
    )
  }
  if (event.code === 'KeyE' && event.metaKey && event.shiftKey && !event.altKey) {
    return setOption(composer, 'fastMode', (current) => current !== true)
  }
  const actions = [...document.querySelectorAll('[data-native-chat-approval-actions]')].find(
    visible
  )
  const options = actions
    ? [...actions.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    : []
  if (
    options.length === 0 ||
    event.altKey ||
    event.ctrlKey ||
    (inComposer && !draftIsEmpty(composer))
  ) {
    return false
  }
  if (event.key === 'Enter' && event.metaKey && event.shiftKey) {
    options[0]?.click()
    return true
  }
  if (event.key === 'Enter' && !event.shiftKey) {
    // ⌘↵ takes the second answer ("Yes, for this session") only when a separate "No" remains.
    const pick = event.metaKey ? (options.length > 2 ? options[1] : null) : options[0]
    pick?.click()
    return !!pick
  }
  if (event.key === 'Backspace' && !event.metaKey && !event.shiftKey && options.length > 1) {
    options.at(-1)?.click()
    return true
  }
  return false
}
