import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  armCloudWakeTyping,
  disarmCloudWakeTyping,
  holdCloudWakeTyping,
  registerCloudWakeTypingTarget,
  resetCloudWakeTypingForTests,
  type CloudWakeTypingTarget
} from './cloud-wake-typing'

function fakePane(): CloudWakeTypingTarget & {
  connected: boolean
  sent: string[]
  notes: string[]
  output: () => void
} {
  let onOutput: (() => void) | null = null
  const sent: string[] = []
  const notes: string[] = []
  const pane = {
    connected: false,
    sent,
    notes,
    output: () => onOutput?.(),
    isConnected: () => pane.connected,
    watchOutput: (callback: () => void) => {
      onOutput = callback
      return () => {
        onOutput = null
      }
    },
    send: (text: string) => {
      pane.sent.push(text)
    },
    note: (text: string) => {
      pane.notes.push(text)
    }
  }
  return pane
}

describe('cloud wake typing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetCloudWakeTypingForTests()
  })
  afterEach(() => {
    resetCloudWakeTypingForTests()
    vi.useRealTimers()
  })

  it('passes keys through when the workspace is not waking or the pane is connected', () => {
    expect(holdCloudWakeTyping('tab:1', 'wt', 'a', false)).toBe(false)
    armCloudWakeTyping('wt')
    expect(holdCloudWakeTyping('tab:1', 'wt', 'a', true)).toBe(false)
  })

  it('types held keys into the new shell once, in order, after its prompt settles', () => {
    const pane = fakePane()
    registerCloudWakeTypingTarget('tab:1', pane)
    armCloudWakeTyping('wt')
    for (const key of 'echo hi\r') {
      expect(holdCloudWakeTyping('tab:1', 'wt', key, false)).toBe(true)
    }
    vi.advanceTimersByTime(5_000)
    expect(pane.sent).toEqual([])
    pane.connected = true
    // Keys typed after the reconnect but before the flush stay behind the held ones.
    expect(holdCloudWakeTyping('tab:1', 'wt', 'x', true)).toBe(true)
    vi.advanceTimersByTime(200)
    pane.output()
    vi.advanceTimersByTime(200)
    expect(pane.sent).toEqual([])
    vi.advanceTimersByTime(600)
    expect(pane.sent).toEqual(['echo hi\rx'])
    vi.advanceTimersByTime(5_000)
    expect(pane.sent).toHaveLength(1)
    expect(holdCloudWakeTyping('tab:1', 'wt', 'y', true)).toBe(false)
  })

  it('follows the pane to the session that replaces it on remount', () => {
    const before = fakePane()
    const unregister = registerCloudWakeTypingTarget('tab:1', before)
    armCloudWakeTyping('wt')
    holdCloudWakeTyping('tab:1', 'wt', 'ls\r', false)
    unregister()
    const after = fakePane()
    registerCloudWakeTypingTarget('tab:1', after)
    after.connected = true
    vi.advanceTimersByTime(1_000)
    expect(before.sent).toEqual([])
    expect(after.sent).toEqual(['ls\r'])
  })

  it('drops held keys with a note when the reconnect takes over 60 s', () => {
    const pane = fakePane()
    registerCloudWakeTypingTarget('tab:1', pane)
    armCloudWakeTyping('wt')
    holdCloudWakeTyping('tab:1', 'wt', 'ls\r', false)
    vi.advanceTimersByTime(60_500)
    pane.connected = true
    vi.advanceTimersByTime(1_000)
    expect(pane.sent).toEqual([])
    expect(pane.notes).toHaveLength(1)
  })

  it('drops held keys silently when the pane is closed', () => {
    const pane = fakePane()
    const unregister = registerCloudWakeTypingTarget('tab:1', pane)
    armCloudWakeTyping('wt')
    holdCloudWakeTyping('tab:1', 'wt', 'ls\r', false)
    unregister()
    vi.advanceTimersByTime(4_000)
    const reopened = fakePane()
    reopened.connected = true
    registerCloudWakeTypingTarget('tab:1', reopened)
    vi.advanceTimersByTime(1_000)
    expect(reopened.sent).toEqual([])
    expect(pane.notes).toEqual([])
  })

  it('caps the hold at 4 KB and says so', () => {
    const pane = fakePane()
    registerCloudWakeTypingTarget('tab:1', pane)
    armCloudWakeTyping('wt')
    holdCloudWakeTyping('tab:1', 'wt', 'a'.repeat(4000), false)
    holdCloudWakeTyping('tab:1', 'wt', 'b'.repeat(200), false)
    pane.connected = true
    vi.advanceTimersByTime(1_000)
    expect(pane.sent).toEqual(['a'.repeat(4000)])
    expect(pane.notes).toHaveLength(1)
  })

  it('drops held keys with a note when the wake fails', () => {
    const pane = fakePane()
    registerCloudWakeTypingTarget('tab:1', pane)
    armCloudWakeTyping('wt')
    holdCloudWakeTyping('tab:1', 'wt', 'ls\r', false)
    disarmCloudWakeTyping('wt')
    pane.connected = true
    vi.advanceTimersByTime(1_000)
    expect(pane.sent).toEqual([])
    expect(pane.notes).toHaveLength(1)
  })
})
