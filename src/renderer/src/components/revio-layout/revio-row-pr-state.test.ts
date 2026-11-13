import { describe, expect, it } from 'vitest'
import { revioRowAgentIcon, revioRowPrState } from './revio-row-pr-state'
import type { WorktreeCardPrDisplay } from '@/components/sidebar/workspace-card/review/worktree-card-pr-display'

function pr(overrides: Partial<Extract<WorktreeCardPrDisplay, { mergeable: unknown }>>) {
  return {
    provider: 'github',
    number: 1,
    title: 'Title',
    state: 'open',
    url: 'https://github.com/o/r/pull/1',
    status: 'success',
    updatedAt: '2026-11-10T00:00:00Z',
    mergeable: 'MERGEABLE',
    ...overrides
  } satisfies WorktreeCardPrDisplay
}

describe('revioRowPrState', () => {
  it('has no state without a pull request, or for a closed one', () => {
    expect(revioRowPrState(null)).toBeNull()
    expect(revioRowPrState(pr({ state: 'closed', status: 'failure' }))).toBeNull()
  })

  it('takes the first match in the layout order', () => {
    expect(
      revioRowPrState(pr({ state: 'merged', mergeStateStatus: 'DIRTY', status: 'failure' }))
    ).toBe('merged')
    expect(
      revioRowPrState(
        pr({ autoMergeEnabled: true, mergeQueueRequired: true, mergeStateStatus: 'CLEAN' })
      )
    ).toBe('merge-queued')
    expect(revioRowPrState(pr({ mergeStateStatus: 'CLEAN', status: 'pending' }))).toBe(
      'ready-to-merge'
    )
    expect(
      revioRowPrState(pr({ state: 'draft', mergeStateStatus: 'DIRTY', status: 'failure' }))
    ).toBe('draft-pr')
    expect(revioRowPrState(pr({ mergeStateStatus: 'DIRTY', status: 'failure' }))).toBe(
      'merge-conflict'
    )
    expect(revioRowPrState(pr({ mergeable: 'CONFLICTING' }))).toBe('merge-conflict')
    expect(revioRowPrState(pr({ status: 'failure', mergeStateStatus: 'BLOCKED' }))).toBe(
      'checks-failing'
    )
    expect(revioRowPrState(pr({ status: 'pending', mergeStateStatus: 'BLOCKED' }))).toBe(
      'checks-pending'
    )
    expect(revioRowPrState(pr({ mergeStateStatus: 'BLOCKED' }))).toBe('open-pr')
  })

  it('counts UNSTABLE as ready unless optional checks block', () => {
    const unstable = pr({ mergeStateStatus: 'UNSTABLE', status: 'failure' })
    expect(revioRowPrState(unstable)).toBe('ready-to-merge')
    expect(revioRowPrState(unstable, true)).toBe('checks-failing')
  })

  it('reads a provider summary without merge facts by its state and checks', () => {
    expect(revioRowPrState({ provider: 'gitlab', number: 2, title: 'MR', state: 'open' })).toBe(
      'open-pr'
    )
  })
})

describe('revioRowAgentIcon', () => {
  it('puts setup, failure, then what the agent needs before its work', () => {
    expect(revioRowAgentIcon({ setup: 'running', status: 'failed', phase: 'plan' })).toBe(
      'setting-up'
    )
    expect(revioRowAgentIcon({ setup: null, status: 'failed', phase: 'plan' })).toBe('failed')
    expect(revioRowAgentIcon({ setup: null, status: 'permission', phase: 'plan' })).toBe(
      'needs-plan-response'
    )
    expect(revioRowAgentIcon({ setup: null, status: 'permission', phase: 'question' })).toBe(
      'needs-user-permission'
    )
    expect(revioRowAgentIcon({ setup: null, status: 'working', phase: 'question' })).toBe(
      'needs-user-input'
    )
    expect(revioRowAgentIcon({ setup: null, status: 'working', phase: null })).toBe('working')
    expect(revioRowAgentIcon({ setup: null, status: 'monitoring', phase: null })).toBe('waiting')
    expect(revioRowAgentIcon({ setup: 'failed', status: 'done', phase: null })).toBeNull()
  })
})
