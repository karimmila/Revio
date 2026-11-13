import React from 'react'
import type { ClaudeLoginRoute } from '../../../shared/claude-login-route'

/**
 * The login a Claude launch on this Mac would use, shared by every place that must not start a
 * chat (or call a workspace "Failed") while nobody is signed in. Null while unknown, so an
 * unanswered read never blocks or relabels anything.
 */
let route: ClaudeLoginRoute | null = null
let reading: Promise<ClaudeLoginRoute | null> | null = null
let watching = false
const listeners = new Set<() => void>()

function publish(next: ClaudeLoginRoute | null): void {
  if (next === route) {
    return
  }
  route = next
  for (const listener of listeners) {
    listener()
  }
}

/** No preload bridge (a unit test of an unrelated surface) reads as unknown, never as a throw. */
function readRoute(): Promise<ClaudeLoginRoute | null> {
  try {
    return window.api.claudeAccounts.loginRoute()
  } catch {
    return Promise.resolve(null)
  }
}

/** Re-reads the route from main; concurrent callers share one read. */
export function refreshClaudeLoginRoute(): Promise<ClaudeLoginRoute | null> {
  reading ??= readRoute()
    .then((next) => {
      publish(next)
      return next
    })
    .catch(() => route)
    .finally(() => {
      reading = null
    })
  return reading
}

export function claudeLoginRouteNow(): ClaudeLoginRoute | null {
  return route
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!watching) {
    watching = true
    // Signing in happens in a terminal or the browser, so the answer changes while unfocused.
    window.addEventListener('focus', () => void refreshClaudeLoginRoute())
    void refreshClaudeLoginRoute()
  }
  return () => listeners.delete(listener)
}

export function useClaudeLoginRoute(): ClaudeLoginRoute | null {
  return React.useSyncExternalStore(subscribe, claudeLoginRouteNow)
}

export function resetClaudeLoginRouteForTest(next: ClaudeLoginRoute | null = null): void {
  route = next
  reading = null
}
