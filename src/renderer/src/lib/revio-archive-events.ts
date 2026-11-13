const listeners = new Set<() => void>()

export function notifyArchiveChanged(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function onRevioArchiveChanged(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
