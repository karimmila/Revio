import { describe, expect, it } from 'vitest'
import { revioAutoMergeMode, describePullRequest, type PrLike } from './revio-pr-status'

const open: PrLike = {
  number: 1,
  title: 't',
  url: 'u',
  state: 'open',
  mergeable: 'MERGEABLE',
  reviewDecision: null,
  checks: 'success',
  mergeStateStatus: 'CLEAN'
}

it("follows the layout's order of PR states, each with its one fix", () => {
  const label = (pr: Partial<PrLike>, uncommitted = 0) => {
    const status = describePullRequest({ ...open, ...pr }, uncommitted)
    return [status.label, status.action]
  }
  expect(label({})).toEqual(['Ready to merge', 'merge'])
  expect(label({ state: 'merged' })).toEqual(['Merged', null])
  expect(label({ state: 'draft' })).toEqual(['Draft', null])
  expect(label({ mergeable: 'CONFLICTING' })).toEqual(['Merge conflicts', 'resolveConflicts'])
  expect(label({ checks: 'failure' })).toEqual(['Checks failing', 'fixErrors'])
  expect(label({}, 2)).toEqual(['Uncommitted changes', 'commitAndPush'])
  expect(label({ checks: 'pending' })).toEqual(['Checks pending', null])
  expect(label({ reviewDecision: 'CHANGES_REQUESTED' })).toEqual(['Changes requested', null])
  expect(label({ reviewDecision: 'REVIEW_REQUIRED' })).toEqual(['PR review required', null])
  expect(label({ mergeStateStatus: 'BLOCKED' })).toEqual(['Blocked', null])
  expect(label({ mergeable: 'UNKNOWN', reviewDecision: 'APPROVED' })).toEqual(['Approved', null])
})

describe('optional checks and the merge queue', () => {
  const unstable = { ...open, mergeable: 'MERGEABLE' as const, mergeStateStatus: 'UNSTABLE' }

  it('lets only required checks hold the PR unless optional checks block', () => {
    const failingOptional = { ...unstable, checks: 'failure' }
    expect(describePullRequest(failingOptional, 0).label).toBe('Ready to merge')
    expect(describePullRequest(failingOptional, 0, true).label).toBe('Checks failing')
    expect(describePullRequest({ ...unstable, checks: 'pending' }, 0, true).label).toBe(
      'Checks pending'
    )
  })

  it('keeps required failures blocking either way', () => {
    const blocked = { ...open, checks: 'failure', mergeStateStatus: 'BLOCKED' }
    expect(describePullRequest(blocked, 0).label).toBe('Checks failing')
  })

  it('says Queued while the PR waits in a required merge queue', () => {
    const queued = { ...open, autoMergeEnabled: true, mergeQueueRequired: true }
    expect(describePullRequest(queued, 0)).toMatchObject({ label: 'Queued', action: null })
  })
})

describe('Automerge', () => {
  const base = {
    enabledInSettings: true,
    checksPending: true,
    autoMergeEnabled: false,
    autoMergeAllowed: true,
    stacked: false,
    provider: 'github'
  }

  it('offers Automerge while checks are pending, and Disable once it is on', () => {
    expect(revioAutoMergeMode(base)).toBe('enable')
    expect(revioAutoMergeMode({ ...base, autoMergeEnabled: true })).toBe('disable')
  })

  it('stays hidden when off in settings, not pending, stacked, disallowed or not GitHub', () => {
    expect(revioAutoMergeMode({ ...base, enabledInSettings: false })).toBeNull()
    expect(revioAutoMergeMode({ ...base, checksPending: false })).toBeNull()
    expect(revioAutoMergeMode({ ...base, stacked: true })).toBeNull()
    expect(revioAutoMergeMode({ ...base, autoMergeAllowed: false })).toBeNull()
    expect(revioAutoMergeMode({ ...base, provider: 'gitlab' })).toBeNull()
  })

  it('marks Checks pending so the bar can offer it', () => {
    const pending = describePullRequest(
      {
        number: 1,
        title: 't',
        url: 'u',
        state: 'open',
        mergeable: 'MERGEABLE',
        checks: 'pending'
      },
      0
    )
    expect(pending.checksPending).toBe(true)
  })
})
