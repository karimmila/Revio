import { describe, expect, it } from 'vitest'
import type { GitHistoryResult } from '../../../../shared/git/history/git-history-types'
import { branchCommits } from './revio-branch-commits'

function result(ids: string[], mergeBase?: string): GitHistoryResult {
  return {
    items: ids.map((id) => ({ id, parentIds: [], subject: id, message: id })),
    mergeBase,
    hasIncomingChanges: false,
    hasOutgoingChanges: false,
    hasMore: false,
    limit: 50
  }
}

describe('branchCommits', () => {
  it('stops at the merge base', () => {
    expect(branchCommits(result(['c', 'b', 'a', 'base', 'old'], 'base')).map((c) => c.id)).toEqual([
      'c',
      'b',
      'a'
    ])
  })

  it('lists nothing without a merge base or result', () => {
    expect(branchCommits(result(['c', 'b']))).toEqual([])
    expect(branchCommits(undefined)).toEqual([])
  })
})
