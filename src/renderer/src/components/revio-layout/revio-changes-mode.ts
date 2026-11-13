import React from 'react'

/** The Changes view: everything on the branch, or only what is not committed yet. */
export type RevioChangesMode = 'all' | 'uncommitted'

let mode: RevioChangesMode = 'all'
const listeners = new Set<() => void>()

export function setRevioChangesMode(next: RevioChangesMode): void {
  if (next === mode) {
    return
  }
  mode = next
  for (const listener of listeners) {
    listener()
  }
}

export function useRevioChangesMode(): RevioChangesMode {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => mode
  )
}

const targetPickerListeners = new Set<() => void>()

/** "Select target branch...": asks the Changes panel to open its base ref picker. */
export function requestRevioTargetBranchPicker(): void {
  for (const listener of targetPickerListeners) {
    listener()
  }
}

export function useRevioTargetBranchPickerRequests(open: (open: boolean) => void): void {
  React.useEffect(() => {
    const listener = (): void => open(true)
    targetPickerListeners.add(listener)
    return () => {
      targetPickerListeners.delete(listener)
    }
  }, [open])
}
