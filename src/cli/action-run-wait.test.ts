import { describe, expect, it, vi } from 'vitest'
import { waitForActionRun } from './action-run-wait'

function client(tails: string[][], status = 'running') {
  let index = 0
  return {
    call: vi.fn(async () => {
      const tail = tails[Math.min(index, tails.length - 1)] ?? []
      index += 1
      return {
        id: '1',
        ok: true as const,
        result: { terminal: { tail, status } },
        _meta: { runtimeId: 'r' }
      }
    })
  }
}

describe('waitForActionRun', () => {
  it('ends at the exit line and keeps the output before it', async () => {
    const c = client([['▶ Run tests'], ['▶ Run tests', 'ok 3 tests', '■ Run tests exited 1', '$ ']])
    const result = await waitForActionRun(c, 'term_a', 'Run tests', 10_000, {
      sleep: async () => {}
    })
    expect(result).toEqual({
      finished: true,
      timedOut: false,
      exitCode: 1,
      tail: ['▶ Run tests', 'ok 3 tests', '■ Run tests exited 1']
    })
    expect(c.call).toHaveBeenCalledWith('terminal.read', { terminal: 'term_a', limit: 400 })
  })

  it('ignores the exit line of another action', async () => {
    let clock = 0
    const c = client([['■ Other exited 0']])
    const result = await waitForActionRun(c, 'term_a', 'Run tests', 1_000, {
      now: () => clock,
      sleep: async (ms) => {
        clock += ms
      }
    })
    expect(result).toMatchObject({ finished: false, timedOut: true, exitCode: null })
  })

  it('treats a closed terminal as finished', async () => {
    const result = await waitForActionRun(client([['bye']], 'exited'), 'term_a', 'X', 1_000)
    expect(result).toMatchObject({ finished: true, exitCode: null, tail: ['bye'] })
  })
})
