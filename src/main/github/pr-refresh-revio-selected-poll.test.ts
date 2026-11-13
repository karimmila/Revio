import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitHubPRRefreshCandidate } from '../../shared/github/pull-request-refresh-types'
import {
  freshRetryAt,
  refreshIntervalForCandidate,
  shouldSkipFresh
} from './pr-refresh-candidate-policy'
import { setPrPollAttentionSource } from './pr-poll-attention'

const NOW = 1_800_000_000_000

function candidate(overrides: Partial<GitHubPRRefreshCandidate> = {}): GitHubPRRefreshCandidate {
  return {
    cacheKey: 'k',
    repoId: 'repo',
    repoPath: '/repo',
    repoKind: 'git',
    branch: 'feature',
    isSelected: true,
    cachedFetchedAt: NOW - 10_500,
    cachedHasPR: true,
    cachedPRState: 'open',
    cachedChecksStatus: 'success',
    ...overrides
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
  setPrPollAttentionSource(() => 'focused')
})

describe('Selected-PR poll through the freshness gate', () => {
  it('lets a visible refresh of the selected PR through 10s after the last fetch', () => {
    const selected = candidate({ revioSelectedPoll: true })
    expect(refreshIntervalForCandidate(selected)).toBe(10_000)
    expect(shouldSkipFresh(selected, 'visible')).toBe(false)
    expect(freshRetryAt(selected)).toBe(NOW - 500)
  })

  it("still skips it inside 10s, and keeps Orca's minute without the mark", () => {
    expect(
      shouldSkipFresh(
        candidate({ revioSelectedPoll: true, cachedFetchedAt: NOW - 5_000 }),
        'visible'
      )
    ).toBe(true)
    expect(shouldSkipFresh(candidate(), 'visible')).toBe(true)
    expect(refreshIntervalForCandidate(candidate())).toBe(60_000)
  })

  it('applies only to the selected, still-open PR', () => {
    expect(
      refreshIntervalForCandidate(candidate({ revioSelectedPoll: true, isSelected: false }))
    ).toBe(120_000)
    expect(
      refreshIntervalForCandidate(candidate({ revioSelectedPoll: true, cachedPRState: 'closed' }))
    ).toBe(15 * 60_000)
    expect(
      refreshIntervalForCandidate(candidate({ revioSelectedPoll: true, cachedPRState: 'draft' }))
    ).toBe(10_000)
  })

  it("drops to Orca's minute when no window is focused, or nobody is at the Mac", () => {
    const selected = candidate({ revioSelectedPoll: true })
    setPrPollAttentionSource(() => 'unfocused')
    expect(refreshIntervalForCandidate(selected)).toBe(60_000)
    expect(shouldSkipFresh(selected, 'visible')).toBe(true)
    setPrPollAttentionSource(() => 'away')
    expect(refreshIntervalForCandidate(selected)).toBe(60_000)
    setPrPollAttentionSource(() => 'focused')
    expect(refreshIntervalForCandidate(selected)).toBe(10_000)
  })
})
