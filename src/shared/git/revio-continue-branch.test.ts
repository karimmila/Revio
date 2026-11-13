import { describe, expect, it } from 'vitest'
import { nextContinueBranchName } from './revio-continue-branch'

describe('nextContinueBranchName', () => {
  it('adds -2 to a plain name and counts up from a numbered one', () => {
    expect(nextContinueBranchName('dev/feat', () => false)).toBe('dev/feat-2')
    expect(nextContinueBranchName('feat-2', () => false)).toBe('feat-3')
  })

  it('skips names that already exist', () => {
    const taken = new Set(['feat-2', 'feat-3'])
    expect(nextContinueBranchName('feat', (name) => taken.has(name))).toBe('feat-4')
  })

  it('gives up when every candidate is taken', () => {
    expect(nextContinueBranchName('feat', () => true)).toBeNull()
  })
})
