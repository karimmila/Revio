import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  revioGraphqlRemaining,
  revioReviewPollIntervalMs,
  revioSelectedPollFields,
  noteRevioRateLimit
} from './revio-review-poll-interval'

const base = {
  revioLayout: true,
  selected: true,
  state: 'open' as const,
  graphqlRemaining: null
}

describe('revioReviewPollIntervalMs', () => {
  it("keeps Orca's interval outside the workspace layout", () => {
    expect(revioReviewPollIntervalMs(60_000, { ...base, revioLayout: false })).toBe(60_000)
  })

  it('polls the selected open or draft PR, or a branch without one, every 10s', () => {
    expect(revioReviewPollIntervalMs(60_000, base)).toBe(10_000)
    expect(revioReviewPollIntervalMs(60_000, { ...base, state: 'draft' })).toBe(10_000)
    expect(revioReviewPollIntervalMs(60_000, { ...base, state: null })).toBe(10_000)
  })

  it('keeps the 10s poll only while the window is focused', () => {
    expect(revioReviewPollIntervalMs(60_000, { ...base, windowFocused: true })).toBe(10_000)
    expect(revioReviewPollIntervalMs(60_000, { ...base, windowFocused: false })).toBe(60_000)
    expect(
      revioReviewPollIntervalMs(15 * 60_000, { ...base, windowFocused: false, state: 'merged' })
    ).toBe(5 * 60_000)
  })

  it('slows the selected poll to a minute when the GraphQL budget is low', () => {
    expect(revioReviewPollIntervalMs(60_000, { ...base, graphqlRemaining: 999 })).toBe(60_000)
    expect(revioReviewPollIntervalMs(60_000, { ...base, graphqlRemaining: 1000 })).toBe(10_000)
  })

  it('keeps on-screen rows at most 5 minutes apart and leaves faster ones alone', () => {
    const row = { ...base, selected: false }
    expect(revioReviewPollIntervalMs(120_000, row)).toBe(120_000)
    expect(revioReviewPollIntervalMs(15 * 60_000, row)).toBe(5 * 60_000)
    expect(revioReviewPollIntervalMs(15 * 60_000, { ...base, state: 'closed' })).toBe(5 * 60_000)
  })

  it('never polls a merged PR whose checks finished', () => {
    expect(revioReviewPollIntervalMs(null, { ...base, state: 'merged' })).toBeNull()
  })
})

const NOW_MS = Date.UTC(2026, 0, 15, 12, 0, 0)

describe('noteRevioRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW_MS)
  })
  afterEach(() => {
    noteRevioRateLimit(null)
    vi.useRealTimers()
  })

  it('records GraphQL points left only from a current, known window', () => {
    const bucket = (remaining: number, limit: number, resetInSeconds: number) => ({
      remaining,
      limit,
      resetAt: Math.floor(NOW_MS / 1000) + resetInSeconds
    })
    const snapshot = (graphql: ReturnType<typeof bucket>) => ({
      ok: true as const,
      snapshot: { core: graphql, search: graphql, graphql, fetchedAt: NOW_MS }
    })
    noteRevioRateLimit(snapshot(bucket(400, 5000, 600)))
    expect(revioGraphqlRemaining()).toBe(400)
    noteRevioRateLimit(snapshot(bucket(400, 5000, -10)))
    expect(revioGraphqlRemaining()).toBeNull()
    noteRevioRateLimit(snapshot(bucket(0, 0, 600)))
    expect(revioGraphqlRemaining()).toBeNull()
    noteRevioRateLimit({ ok: false, error: 'offline' })
    expect(revioGraphqlRemaining()).toBeNull()
  })
})

describe('revioSelectedPollFields', () => {
  afterEach(() => noteRevioRateLimit(null))

  it('marks only the selected workspace, and not while the GraphQL budget is low', () => {
    expect(revioSelectedPollFields(true, true)).toEqual({ revioSelectedPoll: true })
    expect(revioSelectedPollFields(true, false)).toEqual({})
    expect(revioSelectedPollFields(false, true)).toEqual({})
    const graphql = { remaining: 500, limit: 5000, resetAt: Math.floor(Date.now() / 1000) + 600 }
    noteRevioRateLimit({
      ok: true,
      snapshot: { core: graphql, search: graphql, graphql, fetchedAt: Date.now() }
    })
    expect(revioSelectedPollFields(true, true)).toEqual({})
  })
})
