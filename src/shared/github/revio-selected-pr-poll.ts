import type { PRState } from './pull-request-types'

/**
 * The workspace layout re-reads the selected workspace's PR this often (a 5s poll is the target;
 * Orca's per-branch 10s cooldown is the floor). Local GitHub repos refresh through main's
 * coordinator, whose freshness gate would otherwise hold the selected PR to 60s.
 */
export const REVIO_SELECTED_PR_POLL_MS = 10_000

/**
 * Whether someone is looking: the fast poll only runs for a focused, visible window. Unfocused
 * falls back to Orca's own selected cadence (60s); away (hidden, idle, locked) pauses it.
 */
export type PrPollAttention = 'focused' | 'unfocused' | 'away'

type PollCandidate = {
  isSelected?: boolean
  revioSelectedPoll?: boolean
  cachedPRState?: PRState | null
}

/** A merged or closed PR keeps Orca's slower cadence; it no longer changes on GitHub. */
export function isRevioSelectedPoll(
  candidate: PollCandidate,
  attention: PrPollAttention = 'focused'
): boolean {
  return (
    attention === 'focused' &&
    candidate.isSelected === true &&
    candidate.revioSelectedPoll === true &&
    candidate.cachedPRState !== 'merged' &&
    candidate.cachedPRState !== 'closed'
  )
}

export function withRevioSelectedPoll(
  intervalMs: number,
  candidate: PollCandidate,
  attention: PrPollAttention = 'focused'
): number {
  return isRevioSelectedPoll(candidate, attention)
    ? Math.min(intervalMs, REVIO_SELECTED_PR_POLL_MS)
    : intervalMs
}
