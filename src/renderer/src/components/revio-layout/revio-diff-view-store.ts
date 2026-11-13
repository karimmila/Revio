import { useSyncExternalStore } from 'react'

// The workspace layout keeps "Entire file" and file edit mode as view state, not settings: every
// app run starts folded and read-only.
let entireFile = false
let editMode = false
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function revioDiffShowsEntireFile(): boolean {
  return entireFile
}

export function setRevioDiffEntireFile(next: boolean): void {
  if (next !== entireFile) {
    entireFile = next
    emit()
  }
}

export function useRevioDiffEntireFile(): boolean {
  return useSyncExternalStore(subscribe, revioDiffShowsEntireFile)
}

export function revioDiffEditMode(): boolean {
  return editMode
}

/** ⌘E "Toggle file edit mode": working-tree diffs take edits only while this is on. */
export function setRevioDiffEditMode(next: boolean): void {
  if (next !== editMode) {
    editMode = next
    emit()
  }
}

export function useRevioDiffEditMode(): boolean {
  return useSyncExternalStore(subscribe, revioDiffEditMode)
}
