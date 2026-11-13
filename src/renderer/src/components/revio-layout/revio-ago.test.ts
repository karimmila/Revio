import { describe, expect, it } from 'vitest'
import { formatRevioAgo, formatRevioAgoPhrase } from './revio-ago'

const NOW = Date.UTC(2026, 10, 12, 12, 0, 0)

describe('workspace ages', () => {
  it('reads "just now" under a minute, never "now ago"', () => {
    expect(formatRevioAgoPhrase(NOW - 5_000, NOW)).toBe('just now')
    expect(formatRevioAgo(NOW - 5_000, NOW)).toBe('now')
  })

  it('reads minutes, hours and days ago after that', () => {
    expect(formatRevioAgoPhrase(NOW - 5 * 60_000, NOW)).toBe('5m ago')
    expect(formatRevioAgoPhrase(NOW - 3 * 3_600_000, NOW)).toBe('3h ago')
    expect(formatRevioAgoPhrase(NOW - 2 * 86_400_000, NOW)).toBe('2d ago')
  })
})
