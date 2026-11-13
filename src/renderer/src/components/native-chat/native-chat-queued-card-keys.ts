export type QueuedCardKeyAction = 'edit' | 'delete' | 'steer'

/**
 * The single keys on a focused queued card: e edits, ⌫ deletes, ↵ steers (or sends).
 * Only a press on the card itself counts, so its buttons and inline editor keep their keys.
 */
export function queuedCardKeyAction(event: {
  key: string
  target: EventTarget | null
  currentTarget: EventTarget | null
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}): QueuedCardKeyAction | null {
  if (event.target !== event.currentTarget) {
    return null
  }
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return null
  }
  switch (event.key) {
    case 'e':
    case 'E':
      return 'edit'
    case 'Backspace':
    case 'Delete':
      return 'delete'
    case 'Enter':
      return 'steer'
    default:
      return null
  }
}

type KeyEvent = Parameters<typeof queuedCardKeyAction>[0] & { preventDefault: () => void }

/** Runs the card action a key names; an absent handler leaves the key alone. */
export function runQueuedCardKey(
  event: KeyEvent,
  handlers: Partial<Record<QueuedCardKeyAction, (() => void) | undefined>>
): void {
  const action = queuedCardKeyAction(event)
  const run = action ? handlers[action] : undefined
  if (run) {
    event.preventDefault()
    run()
  }
}
