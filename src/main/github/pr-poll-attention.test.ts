import { afterEach, describe, expect, it } from 'vitest'
import { isRevioSelectedPoll } from '../../shared/github/revio-selected-pr-poll'
import {
  currentPrPollAttention,
  resolvePrPollAttention,
  setPrPollAttentionSource
} from './pr-poll-attention'

const looking = { idleState: 'active', anyWindowVisible: true, anyWindowFocused: true } as const

afterEach(() => setPrPollAttentionSource(() => 'focused'))

describe('PR poll attention', () => {
  it('is focused only for a focused, visible window with someone at the Mac', () => {
    expect(resolvePrPollAttention(looking)).toBe('focused')
    expect(resolvePrPollAttention({ ...looking, anyWindowFocused: false })).toBe('unfocused')
  })

  it('is away when every window is hidden, the system is idle, or the screen is locked', () => {
    expect(resolvePrPollAttention({ ...looking, anyWindowVisible: false })).toBe('away')
    expect(resolvePrPollAttention({ ...looking, idleState: 'idle' })).toBe('away')
    expect(resolvePrPollAttention({ ...looking, idleState: 'locked' })).toBe('away')
  })

  it('does not pause when the platform cannot tell the idle state', () => {
    expect(resolvePrPollAttention({ ...looking, idleState: 'unknown' })).toBe('focused')
  })

  it('falls back to focused when the reader throws, so a broken probe never stops polling', () => {
    setPrPollAttentionSource(() => {
      throw new Error('destroyed window')
    })
    expect(currentPrPollAttention()).toBe('focused')
  })

  it('gives the budget bypass only to a focused window', () => {
    const selected = {
      isSelected: true,
      revioSelectedPoll: true,
      cachedPRState: 'open' as const
    }
    expect(isRevioSelectedPoll(selected, 'focused')).toBe(true)
    expect(isRevioSelectedPoll(selected, 'unfocused')).toBe(false)
    expect(isRevioSelectedPoll(selected, 'away')).toBe(false)
  })
})
