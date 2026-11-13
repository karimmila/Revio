import { describe, expect, it, vi } from 'vitest'
import { buildChangeRows } from './RevioChangesList'

describe('buildChangeRows', () => {
  it('lists each path once, adds committed and uncommitted counts, and opens the newer diff', () => {
    const openUncommitted = vi.fn()
    const openCommitted = vi.fn()
    const rows = buildChangeRows(
      [
        { path: 'b.ts', status: 'modified', area: 'unstaged', added: 2, removed: 1 },
        { path: 'notes.txt', status: 'untracked', area: 'untracked', added: 3 }
      ],
      [
        { path: 'b.ts', status: 'modified', added: 10, removed: 4 },
        { path: 'a.ts', status: 'added', added: 40 }
      ],
      openUncommitted,
      openCommitted
    )
    expect(rows.map((row) => [row.path, row.letter, row.added, row.removed])).toEqual([
      ['a.ts', 'A', 40, 0],
      ['b.ts', 'M', 12, 5],
      ['notes.txt', 'U', 3, 0]
    ])
    rows[1].open()
    expect(openUncommitted).toHaveBeenCalledTimes(1)
    expect(openCommitted).not.toHaveBeenCalled()
    // Only a path with an uncommitted change offers "Discard changes".
    expect(rows.map((row) => row.uncommitted?.path ?? null)).toEqual([null, 'b.ts', 'notes.txt'])
  })
})

describe('buildChangeRows conflicts', () => {
  it('puts unresolved conflicts first and marks them', () => {
    const rows = buildChangeRows(
      [
        { path: 'a.ts', status: 'modified', area: 'unstaged' },
        {
          path: 'z.ts',
          status: 'modified',
          area: 'unstaged',
          conflictKind: 'both_modified',
          conflictStatus: 'unresolved'
        }
      ],
      [],
      vi.fn(),
      vi.fn()
    )
    expect(rows.map((row) => [row.path, row.letter, row.conflicted])).toEqual([
      ['z.ts', '!', true],
      ['a.ts', 'M', false]
    ])
  })
})
