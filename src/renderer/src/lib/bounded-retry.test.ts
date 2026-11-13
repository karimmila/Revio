import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startBoundedRetry } from './bounded-retry'

describe('startBoundedRetry', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('keeps at most one timer and stops after the last delay', () => {
    const attempt = vi.fn()
    startBoundedRetry({ delaysMs: [0, 1_000, 2_000], attempt, isDone: () => false })
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(0)
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(3_000)
    expect(attempt).toHaveBeenCalledTimes(3)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops early once there is nothing left to retry', () => {
    let pending = 2
    const attempt = vi.fn(() => {
      pending -= 1
    })
    startBoundedRetry({ delaysMs: [0, 1_000, 1_000, 1_000], attempt, isDone: () => pending === 0 })
    vi.advanceTimersByTime(10_000)
    expect(attempt).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels the pending timer', () => {
    const attempt = vi.fn()
    const cancel = startBoundedRetry({ delaysMs: [500, 500], attempt, isDone: () => false })
    cancel()
    vi.advanceTimersByTime(5_000)
    expect(attempt).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
