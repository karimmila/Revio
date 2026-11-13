import React from 'react'

/**
 * Whether GitHub features need a sign-in first: the app is configured and no account is signed
 * in. Null while unknown (or with no app configured), so nothing is hidden on a guess. Shared so
 * every surface that would only get "sign in required" back from main can say so up front.
 */
let signedOut: boolean | null = null
let watching = false
const listeners = new Set<() => void>()

/** No preload bridge (a web client, or a unit test of an unrelated surface) reads as unknown. */
function cloudApi(): typeof window.api.cloud {
  try {
    return window.api.cloud
  } catch {
    return undefined
  }
}

function read(): void {
  void (cloudApi()?.githubStatus() ?? Promise.resolve(null))
    .then((status) => (status?.app.configured ? status.account === null : null))
    .catch(() => null)
    .then((next) => {
      if (next === signedOut) {
        return
      }
      signedOut = next
      for (const listener of listeners) {
        listener()
      }
    })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!watching) {
    watching = true
    cloudApi()?.onGithubEvent(read)
    window.addEventListener('focus', read)
  }
  // Each new reader re-reads: main sends no event for a sign-in finished in another window.
  read()
  return () => listeners.delete(listener)
}

export function useGithubSignedOut(): boolean | null {
  return React.useSyncExternalStore(subscribe, () => signedOut)
}

export function resetGithubSignInStateForTest(): void {
  signedOut = null
  watching = false
  listeners.clear()
}
