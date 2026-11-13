import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: vi.fn() }))

import { failureNeedsSignIn } from './revio-needs-sign-in'

const W = 'repo::/w/add-subtract'
const failed = (agentType?: string, worktreeId = W) => ({
  worktreeId,
  agentType,
  mainAgent: { outcome: 'failure' }
})

describe('failureNeedsSignIn', () => {
  it('reads a failed chat as "Needs sign-in" while Claude has no login on this Mac', () => {
    expect(failureNeedsSignIn(W, 'failed', 'none', [failed('claude')])).toBe(true)
    expect(failureNeedsSignIn(W, 'failed', 'none', [failed()])).toBe(true)
  })

  it('keeps "Failed" once Claude is signed in, or while the answer is unknown', () => {
    expect(failureNeedsSignIn(W, 'failed', 'system', [failed('claude')])).toBe(false)
    expect(failureNeedsSignIn(W, 'failed', 'managed', [failed('claude')])).toBe(false)
    expect(failureNeedsSignIn(W, 'failed', null, [failed('claude')])).toBe(false)
  })

  it('keeps "Failed" for another agent, which a Claude sign-in would not fix', () => {
    expect(failureNeedsSignIn(W, 'failed', 'none', [failed('claude'), failed('codex')])).toBe(false)
    expect(failureNeedsSignIn(W, 'failed', 'none', [failed('codex', 'repo::/w/other')])).toBe(true)
  })

  it('leaves every other row status alone', () => {
    expect(failureNeedsSignIn(W, 'working', 'none', [])).toBe(false)
    expect(failureNeedsSignIn(W, 'done', 'none', [failed('claude')])).toBe(false)
  })
})
