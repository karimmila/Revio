import { createContext, useSyncExternalStore } from 'react'
import { translate } from '@/i18n/i18n'

/**
 * Keys typed into a cloud workspace's terminal while its sandbox wakes. The pane's old shell died
 * with the sleep, so Orca's own input hold (which never replays keys into a different shell) drops
 * them; this holds them per pane instead and types them into the new shell once it is ready.
 * Scope: only panes of a workspace Orca is waking, only until that pane reconnects.
 */
const HOLD_LIMIT_MS = 60_000
const HOLD_MAX_CHARS = 4096
// After the pane reconnects, the new shell prints its prompt; type once output has paused.
const SHELL_SETTLE_MS = 400
const SHELL_SETTLE_MAX_MS = 3_000
// A pane whose session is gone this long was closed, not remounted.
const PANE_GONE_MS = 3_000
const TICK_MS = 200

export type CloudWakeTypingTarget = {
  isConnected: () => boolean
  /** Calls back on terminal output until the returned stop runs. */
  watchOutput: (onOutput: () => void) => () => void
  send: (text: string) => void
  note: (text: string) => void
}

type HeldTyping = {
  worktreeId: string
  text: string
  deadline: number
  overflowed: boolean
  readySince: number | null
  lastOutputAt: number
  stopWatching: (() => void) | null
  goneSince: number | null
}

const armedUntil = new Map<string, number>()
const held = new Map<string, HeldTyping>()
const targets = new Map<string, CloudWakeTypingTarget>()
const listeners = new Set<() => void>()
let ticker: ReturnType<typeof setInterval> | null = null

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function isArmed(worktreeId: string, now = Date.now()): boolean {
  const until = armedUntil.get(worktreeId)
  return until !== undefined && now < until
}

export function armCloudWakeTyping(worktreeId: string): void {
  const until = Date.now() + HOLD_LIMIT_MS
  armedUntil.set(worktreeId, until)
  emit()
  setTimeout(() => {
    if (armedUntil.get(worktreeId) === until) {
      armedUntil.delete(worktreeId)
      emit()
    }
  }, HOLD_LIMIT_MS)
}

function release(paneKey: string, entry: HeldTyping): void {
  held.delete(paneKey)
  entry.stopWatching?.()
  entry.stopWatching = null
}

function noteLine(text: string): string {
  return `\r\n\x1b[2m${text}\x1b[0m\r\n`
}

function notSentNote(): string {
  return noteLine(
    translate(
      'auto.lib.cloudWakeTyping.notSent',
      '{{productName}}: what you typed while the workspace woke was not sent.'
    )
  )
}

/** The wake failed: nothing will reconnect, so held typing is dropped now. */
export function disarmCloudWakeTyping(worktreeId: string): void {
  armedUntil.delete(worktreeId)
  for (const [paneKey, entry] of held) {
    if (entry.worktreeId === worktreeId) {
      release(paneKey, entry)
      targets.get(paneKey)?.note(notSentNote())
    }
  }
  emit()
}

/**
 * Takes a key a person typed into a pane when it belongs to the woken shell: the pane's workspace
 * is waking and the pane is not connected, or earlier keys are still waiting (order is kept).
 */
export function holdCloudWakeTyping(
  paneKey: string,
  worktreeId: string,
  data: string,
  connected: boolean
): boolean {
  let entry = held.get(paneKey)
  if (!entry) {
    if (connected || !isArmed(worktreeId)) {
      return false
    }
    entry = {
      worktreeId,
      text: '',
      deadline: armedUntil.get(worktreeId) ?? Date.now() + HOLD_LIMIT_MS,
      overflowed: false,
      readySince: null,
      lastOutputAt: 0,
      stopWatching: null,
      goneSince: null
    }
    held.set(paneKey, entry)
  }
  if (entry.text.length + data.length > HOLD_MAX_CHARS) {
    entry.overflowed = true
  } else {
    entry.text += data
  }
  ticker ??= setInterval(tick, TICK_MS)
  return true
}

/** The pane session that now shows this pane; a remount replaces the previous one. */
export function registerCloudWakeTypingTarget(
  paneKey: string,
  target: CloudWakeTypingTarget
): () => void {
  targets.set(paneKey, target)
  return () => {
    if (targets.get(paneKey) === target) {
      targets.delete(paneKey)
    }
  }
}

function tick(): void {
  const now = Date.now()
  for (const [paneKey, entry] of held) {
    const target = targets.get(paneKey)
    if (!target) {
      entry.goneSince ??= now
      if (now - entry.goneSince >= PANE_GONE_MS) {
        release(paneKey, entry)
      }
      continue
    }
    entry.goneSince = null
    if (!target.isConnected()) {
      entry.readySince = null
      if (now >= entry.deadline) {
        release(paneKey, entry)
        target.note(notSentNote())
      }
      continue
    }
    if (entry.readySince === null) {
      entry.readySince = now
      entry.stopWatching?.()
      entry.stopWatching = target.watchOutput(() => {
        entry.lastOutputAt = Date.now()
      })
    }
    const quietSince = Math.max(entry.readySince, entry.lastOutputAt)
    if (now - quietSince < SHELL_SETTLE_MS && now - entry.readySince < SHELL_SETTLE_MAX_MS) {
      continue
    }
    release(paneKey, entry)
    if (entry.text) {
      target.send(entry.text)
    }
    if (entry.overflowed) {
      target.note(
        noteLine(
          translate(
            'auto.lib.cloudWakeTyping.overflow',
            '{{productName}}: only the first 4 KB of what you typed while the workspace woke was sent.'
          )
        )
      )
    }
  }
  if (held.size === 0 && ticker !== null) {
    clearInterval(ticker)
    ticker = null
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCloudWakeTypingArmed(worktreeId: string): boolean {
  return useSyncExternalStore(subscribe, () => isArmed(worktreeId))
}

/** Set around a pane's recovery notices while typing there is held for the woken shell. */
export const CloudWakeTypingHintContext = createContext(false)

export function resetCloudWakeTypingForTests(): void {
  armedUntil.clear()
  for (const [paneKey, entry] of held) {
    release(paneKey, entry)
  }
  targets.clear()
  if (ticker !== null) {
    clearInterval(ticker)
    ticker = null
  }
}
