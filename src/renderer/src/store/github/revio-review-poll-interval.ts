import type { HostedReviewState } from '../../../../shared/source-control/hosted-review/hosted-review-contracts'
import type { GetRateLimitResult } from '../../../../shared/github/rate-limit-types'

/**
 * The workspace layout polls the selected workspace's PR every 5s (1s while GitHub computes
 * mergeability) and on-screen rows every 5 min. Orca's refresh scheduler never runs a branch more
 * often than its 10s cooldown, so the selected PR polls at that floor, which shows an approve or
 * merge on GitHub within about 10s. In the workspace layout, a low GraphQL budget slows the
 * selected poll to a minute.
 */
export const REVIO_SELECTED_REVIEW_INTERVAL_MS = 10_000
export const REVIO_VISIBLE_ROW_MAX_INTERVAL_MS = 5 * 60_000
export const REVIO_LOW_BUDGET_INTERVAL_MS = 60_000
/** The threshold: below this many GraphQL points left, only a slow selected poll runs. */
export const REVIO_LOW_GRAPHQL_REMAINING = 1000

export function revioReviewPollIntervalMs(
  orcaIntervalMs: number | null,
  input: {
    revioLayout: boolean
    selected: boolean
    state: HostedReviewState | null | undefined
    graphqlRemaining: number | null
    /** The fast poll runs only while someone is looking; unfocused keeps Orca's own cadence. */
    windowFocused?: boolean
  }
): number | null {
  if (!input.revioLayout) {
    return orcaIntervalMs
  }
  // A merged PR whose checks finished never changes again; Orca stops polling it.
  if (orcaIntervalMs === null) {
    return null
  }
  if (!input.selected || input.state === 'merged' || input.state === 'closed') {
    return Math.min(orcaIntervalMs, REVIO_VISIBLE_ROW_MAX_INTERVAL_MS)
  }
  if (
    input.windowFocused === false ||
    (input.graphqlRemaining !== null && input.graphqlRemaining < REVIO_LOW_GRAPHQL_REMAINING)
  ) {
    return Math.max(orcaIntervalMs, REVIO_LOW_BUDGET_INTERVAL_MS)
  }
  return Math.min(orcaIntervalMs, REVIO_SELECTED_REVIEW_INTERVAL_MS)
}

let graphqlRemaining: number | null = null

/** Hidden windows are already paused by the visibility-aware scheduler; this covers blur. */
export function revioWindowFocused(): boolean {
  return typeof document === 'undefined' || document.hasFocus()
}

/** The GraphQL points left at the last rate-limit snapshot, or null when unknown. */
export function revioGraphqlRemaining(): number | null {
  return graphqlRemaining
}

export function noteRevioRateLimit(result: GetRateLimitResult | null | undefined): void {
  const bucket = result?.ok ? result.snapshot.graphql : null
  // A limit of 0 means GitHub did not say; an expired window no longer limits anything.
  graphqlRemaining =
    bucket && bucket.limit > 0 && bucket.resetAt * 1000 > Date.now() ? bucket.remaining : null
}

/**
 * Marks the selected workspace's refresh candidate for main's 10s selected poll, unless the
 * GraphQL budget is low; then main keeps Orca's minute, as the workspace layout slows down.
 */
export function revioSelectedPollFields(
  revioLayout: boolean,
  selected: boolean
): { revioSelectedPoll?: true } {
  const low = graphqlRemaining !== null && graphqlRemaining < REVIO_LOW_GRAPHQL_REMAINING
  return revioLayout && selected && !low ? { revioSelectedPoll: true } : {}
}
