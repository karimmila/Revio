import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createProcessQuitEscalation,
  type ProcessQuitEscalationDeps
} from './process-quit-escalation'

const timing = {
  stalledQuitMs: 1000,
  windowlessQuitMs: 300,
  terminalServiceStopMs: 500,
  teardownMs: 2000
}

function escalation(overrides: Partial<ProcessQuitEscalationDeps> = {}) {
  const calls: string[] = []
  let teardownStarted = false
  const deps: ProcessQuitEscalationDeps = {
    markRequested: () => calls.push('mark'),
    closeQuitQuestion: () => calls.push('close-question'),
    quit: () => calls.push('quit'),
    teardownStarted: () => teardownStarted,
    destroyWindows: () => calls.push('destroy-windows'),
    stopTerminalService: async () => {
      calls.push('stop-terminal-service')
    },
    exit: () => calls.push('exit'),
    ...overrides
  }
  return {
    calls,
    onSignal: createProcessQuitEscalation(deps, timing),
    startTeardown: () => {
      teardownStarted = true
    }
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('a signal that asks the app to quit', () => {
  it('marks the quit, closes the open question and quits, in that order', () => {
    const { calls, onSignal } = escalation()
    onSignal()
    expect(calls).toEqual(['mark', 'close-question', 'quit'])
  })

  it('leaves a quit that reached its teardown alone, and exits when the teardown overruns', async () => {
    const { calls, onSignal, startTeardown } = escalation()
    onSignal()
    startTeardown()
    await vi.advanceTimersByTimeAsync(timing.stalledQuitMs)
    expect(calls).toEqual(['mark', 'close-question', 'quit'])
    await vi.advanceTimersByTimeAsync(timing.teardownMs)
    expect(calls).toEqual(['mark', 'close-question', 'quit', 'exit'])
  })

  it('destroys the windows of a quit that stalls, so the ordinary teardown can run', async () => {
    const { calls, onSignal, startTeardown } = escalation()
    onSignal()
    await vi.advanceTimersByTimeAsync(timing.stalledQuitMs)
    expect(calls.slice(3)).toEqual(['destroy-windows', 'quit'])
    startTeardown()
    await vi.advanceTimersByTimeAsync(timing.windowlessQuitMs)
    expect(calls).not.toContain('stop-terminal-service')
    await vi.advanceTimersByTimeAsync(timing.teardownMs)
    expect(calls.at(-1)).toBe('exit')
  })

  it('stops the terminal service itself and exits when the quit never reaches its teardown', async () => {
    const { calls, onSignal } = escalation()
    onSignal()
    await vi.advanceTimersByTimeAsync(timing.stalledQuitMs + timing.windowlessQuitMs)
    expect(calls.slice(3)).toEqual(['destroy-windows', 'quit', 'stop-terminal-service', 'exit'])
  })

  it('exits once, in bounded time, when the terminal service does not stop or fails', async () => {
    const hung = escalation({ stopTerminalService: () => new Promise(() => undefined) })
    hung.onSignal()
    await vi.advanceTimersByTimeAsync(timing.stalledQuitMs + timing.windowlessQuitMs)
    expect(hung.calls).not.toContain('exit')
    await vi.advanceTimersByTimeAsync(timing.terminalServiceStopMs)
    expect(hung.calls.filter((call) => call === 'exit')).toHaveLength(1)

    const failing = escalation({
      stopTerminalService: async () => {
        throw new Error('daemon gone')
      }
    })
    failing.onSignal()
    await vi.advanceTimersByTimeAsync(
      timing.stalledQuitMs + timing.windowlessQuitMs + timing.terminalServiceStopMs
    )
    expect(failing.calls.filter((call) => call === 'exit')).toHaveLength(1)
  })

  it('asks to quit again on every signal and escalates once', async () => {
    const { calls, onSignal } = escalation()
    onSignal()
    onSignal()
    expect(calls.filter((call) => call === 'quit')).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(
      timing.stalledQuitMs + timing.windowlessQuitMs + timing.terminalServiceStopMs
    )
    expect(calls.filter((call) => call === 'destroy-windows')).toHaveLength(1)
    expect(calls.filter((call) => call === 'exit')).toHaveLength(1)
  })
})
