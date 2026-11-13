type KeyLike = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>

/** ⌘S (routine.save) saves the routine being edited; Ctrl+S off macOS. */
export function isRoutineSaveKey(event: KeyLike, isMac: boolean): boolean {
  const mod = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
  return mod && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 's'
}
