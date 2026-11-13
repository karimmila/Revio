import { describe, expect, it, vi } from 'vitest'
import type { ProviderRateLimits } from '../../../../shared/rate-limit-types'
import { revioUsageProvider, revioUsageRows, revioUsageWindowLabel } from './revio-provider-usage'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => values?.[name] ?? '')
}))

const NOW = 1_000_000

function limits(overrides: Partial<ProviderRateLimits>): ProviderRateLimits {
  return {
    provider: 'claude',
    session: null,
    weekly: null,
    updatedAt: NOW,
    error: null,
    status: 'ok',
    ...overrides
  }
}

describe('revioUsageProvider', () => {
  it('covers Claude and Codex chats only', () => {
    expect(revioUsageProvider('claude')).toBe('claude')
    expect(revioUsageProvider('codex')).toBe('codex')
    expect(revioUsageProvider('gemini')).toBeNull()
    expect(revioUsageProvider(undefined)).toBeNull()
  })
})

describe('revioUsageWindowLabel', () => {
  it('names windows by their length', () => {
    expect(revioUsageWindowLabel(300, 'x')).toBe('5h limit')
    expect(revioUsageWindowLabel(10080, 'x')).toBe('7d limit')
    expect(revioUsageWindowLabel(45, 'x')).toBe('45m limit')
  })

  it('keeps the role name when the length is unknown', () => {
    expect(revioUsageWindowLabel(0, 'Secondary limit')).toBe('Secondary limit')
  })
})

describe('revioUsageRows', () => {
  it('returns nothing without usage data', () => {
    expect(revioUsageRows('claude', null, NOW)).toEqual([])
  })

  it('shows remaining percent and flags windows at or under 20% left', () => {
    const rows = revioUsageRows(
      'claude',
      limits({
        session: { usedPercent: 80, windowMinutes: 300, resetsAt: null, resetDescription: '3 PM' },
        weekly: { usedPercent: 10, windowMinutes: 10080, resetsAt: null, resetDescription: null }
      }),
      NOW
    )
    expect(rows).toEqual([
      { label: '5h limit', remainingPercent: 20, low: true, resets: 'Resets 3 PM' },
      {
        label: '7d limit',
        remainingPercent: 90,
        low: false,
        resets: 'Resets reset time unavailable'
      }
    ])
  })

  it('falls back to Codex role names and drops windows that already reset', () => {
    const rows = revioUsageRows(
      'codex',
      limits({
        provider: 'codex',
        session: { usedPercent: 50, windowMinutes: 300, resetsAt: NOW - 1, resetDescription: null },
        weekly: { usedPercent: 120, windowMinutes: 0, resetsAt: NOW + 1, resetDescription: 'Thu' }
      }),
      NOW
    )
    expect(rows).toEqual([
      { label: 'Secondary limit', remainingPercent: 0, low: true, resets: 'Resets Thu' }
    ])
  })
})
