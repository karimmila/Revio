import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: vi.fn() }))

import { failureIsSuperseded } from './revio-stale-failure'

const W = 'repo::/w/say-ok'
const failed = (at: number, worktreeId = W) => ({
  state: 'done' as const,
  worktreeId,
  stateStartedAt: at,
  mainAgent: { outcome: 'failure' }
})
const healthy = (at: number, state: 'done' | 'working' = 'done', worktreeId = W) => ({
  state,
  worktreeId,
  stateStartedAt: at,
  mainAgent: { outcome: 'success' }
})

describe('failureIsSuperseded', () => {
  it('drops a failure once a later chat in the workspace worked or finished cleanly', () => {
    expect(failureIsSuperseded(W, [failed(100), healthy(200)])).toBe(true)
    expect(failureIsSuperseded(W, [failed(100), healthy(150, 'working')])).toBe(true)
  })

  it('keeps a failure that is the newest thing in the workspace', () => {
    expect(failureIsSuperseded(W, [healthy(100), failed(200)])).toBe(false)
    expect(failureIsSuperseded(W, [failed(200)])).toBe(false)
  })

  it('ignores other workspaces', () => {
    expect(failureIsSuperseded(W, [failed(100), healthy(300, 'done', 'repo::/other')])).toBe(false)
  })
})
