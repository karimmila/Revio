import React from 'react'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { findWorktreeById } from '@/store/slices/worktree-helpers'

/**
 * Sleep takes the workspace off screen: its panes must unmount before their terminals stop, and
 * opening it again is what wakes it. So the layout cannot keep it as the active workspace; this
 * remembers it instead, and the center shows its "asleep" screen (with Wake) where Home would be.
 */
type AsleepView = {
  worktreeId: string
  askedAt: number
  /** The sleep has taken the workspace off screen, so its screen is the one showing. */
  left: boolean
}

// A sleep that has not started by now was refused or cancelled (the twin-host confirm).
const SLEEP_START_LIMIT_MS = 30_000

let view: AsleepView | null = null
let stopWatching: (() => void) | null = null
const listeners = new Set<() => void>()

function setView(next: AsleepView | null): void {
  view = next
  if (next === null) {
    stopWatching?.()
    stopWatching = null
  }
  for (const listener of listeners) {
    listener()
  }
}

type WatchedState = Pick<
  AppState,
  'activeWorktreeId' | 'activeView' | 'activePendingCreationId' | 'worktreesByRepo'
>

/** What the remembered workspace becomes after a store change: kept, kept as off screen, or dropped. */
export function nextAsleepView(
  current: AsleepView,
  state: WatchedState,
  now: number
): AsleepView | null {
  const gone = !findWorktreeById(selectWorktreesByRepo(state), current.worktreeId)
  if (gone || state.activeView !== 'terminal' || state.activePendingCreationId !== null) {
    return null
  }
  if (state.activeWorktreeId === null) {
    if (current.left) {
      return current
    }
    return now - current.askedAt > SLEEP_START_LIMIT_MS ? null : { ...current, left: true }
  }
  // Still on screen while the sleep starts. Once it has left, any workspace on screen ends this:
  // another one was opened, or this one was (Wake, or a failed sleep put it back).
  return state.activeWorktreeId === current.worktreeId && !current.left ? current : null
}

/** Call when Sleep is chosen for the workspace on screen. */
export function showAsleepViewAfterSleep(worktreeId: string, now = Date.now()): void {
  stopWatching?.()
  stopWatching = useAppStore.subscribe((state) => {
    if (!view) {
      return
    }
    const next = nextAsleepView(view, state, Date.now())
    if (next !== view) {
      setView(next)
    }
  })
  setView({ worktreeId, askedAt: now, left: false })
}

/** Home, or any other way off the asleep screen that leaves no workspace active. */
export function clearRevioAsleepView(): void {
  if (view) {
    setView(null)
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The workspace whose asleep screen takes Home's place, or null. */
export function useRevioAsleepViewId(): string | null {
  const read = (): string | null => view?.worktreeId ?? null
  return React.useSyncExternalStore(subscribe, read, read)
}

/** The row of the workspace on the asleep screen reads as the selected one. */
export function useIsRevioAsleepView(worktreeId: string): boolean {
  const read = (): boolean => view?.worktreeId === worktreeId
  return React.useSyncExternalStore(subscribe, read, read)
}
