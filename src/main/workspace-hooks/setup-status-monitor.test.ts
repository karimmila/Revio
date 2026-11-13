import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SETUP_STATUS_NEW_WORKTREE_MS,
  SetupStatusMonitor,
  type SetupStatusEvent,
  type SetupStatusReading
} from './setup-status-monitor'

function harness() {
  const files = new Map<string, SetupStatusReading>()
  const events: SetupStatusEvent[] = []
  const read = vi.fn((path: string) => files.get(path) ?? null)
  const monitor = new SetupStatusMonitor({ read, emit: (event) => events.push(event) })
  return {
    files,
    events,
    read,
    monitor,
    timerCount: () => vi.getTimerCount(),
    advance: (ms: number) => vi.advanceTimersByTime(ms)
  }
}

describe('SetupStatusMonitor', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('polls once for every window and emits a finished run once', () => {
    const h = harness()
    h.files.set('/a', { status: 'running', runId: '1' })
    expect(h.monitor.watch(1, ['/a'])).toEqual({ '/a': 'running' })
    h.monitor.watch(2, ['/a'])
    expect(h.timerCount()).toBe(1)

    h.files.set('/a', { status: 'succeeded', runId: '2' })
    h.advance(2_000)
    h.advance(2_000)

    expect(h.events.filter((event) => event.kind === 'finished')).toEqual([
      { kind: 'finished', path: '/a', status: 'succeeded', runId: '2' }
    ])
    // Finished setups are no longer read, so the timer stops.
    expect(h.timerCount()).toBe(0)
  })

  it('grants a finished run to exactly one window', () => {
    const h = harness()
    expect(h.monitor.claim('/a', '2')).toBe(true)
    expect(h.monitor.claim('/a', '2')).toBe(false)
    // A later setup run of the same workspace is a new claim.
    expect(h.monitor.claim('/a', '3')).toBe(true)
  })

  it('emits setup start and keeps waiting for a new workspace whose runner starts late', () => {
    const h = harness()
    h.monitor.watch(1, ['/new'])
    h.files.set('/new', { status: 'running', runId: '1' })
    h.advance(2_000)
    expect(h.events).toContainEqual({ kind: 'changed', path: '/new', status: 'running' })
  })

  it('stops reading a workspace that never got a status file, and when windows close', () => {
    const h = harness()
    h.monitor.watch(1, ['/plain'])
    h.advance(SETUP_STATUS_NEW_WORKTREE_MS + 1)
    expect(h.timerCount()).toBe(0)

    h.files.set('/b', { status: 'running', runId: '1' })
    h.monitor.watch(1, ['/b'])
    expect(h.timerCount()).toBe(1)
    h.monitor.unwatch(1)
    expect(h.timerCount()).toBe(0)
  })
})
