import type { PrPollAttention } from '../../shared/github/revio-selected-pr-poll'

/** While nobody is at the Mac, queued visible PR refreshes re-check this often instead of fetching. */
export const PR_POLL_AWAY_RECHECK_MS = 60_000

export type PrPollAttentionInput = {
  /** powerMonitor.getSystemIdleState(); 'unknown' must not pause polling. */
  idleState: 'active' | 'idle' | 'locked' | 'unknown'
  anyWindowVisible: boolean
  anyWindowFocused: boolean
}

export function resolvePrPollAttention(input: PrPollAttentionInput): PrPollAttention {
  if (input.idleState === 'idle' || input.idleState === 'locked' || !input.anyWindowVisible) {
    return 'away'
  }
  return input.anyWindowFocused ? 'focused' : 'unfocused'
}

// Electron-free so the refresh policy and drainer stay unit-testable; startup installs the reader.
let readAttention: () => PrPollAttention = () => 'focused'

export function setPrPollAttentionSource(source: () => PrPollAttention): void {
  readAttention = source
}

export function currentPrPollAttention(): PrPollAttention {
  try {
    return readAttention()
  } catch {
    return 'focused'
  }
}
