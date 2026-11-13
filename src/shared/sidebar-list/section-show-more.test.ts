import { describe, expect, it } from 'vitest'
import type { Worktree } from '../worktree/types'
import type { Row } from './row-types'
import { capSidebarSections, MAIN_SECTION_KEY } from './section-show-more'

function header(key: string): Row {
  return { type: 'header', key, count: 0, icon: { kind: 'all' } }
}
function item(id: string, depth = 0): Row {
  const worktree: Worktree = {
    id,
    instanceId: id,
    repoId: 'r',
    path: `/w/${id}`,
    branch: id,
    head: 'abc',
    isBare: false,
    isMainWorktree: false,
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    comment: '',
    isUnread: false,
    isPinned: false,
    displayName: id,
    sortOrder: 0,
    lastActivityAt: 0
  }
  return {
    type: 'item',
    rowKey: id,
    sectionKey: 's',
    worktree,
    repo: undefined,
    depth,
    groupDepth: 0,
    isLastLineageChild: false,
    lineageChildCount: 0
  }
}
function shape(rows: Row[]): string[] {
  return rows.map((row) =>
    row.type === 'header'
      ? `H ${row.key}`
      : row.type === 'show-more'
        ? `more ${row.sectionKey} ${row.hiddenCount}`
        : row.type === 'item'
          ? `${row.depth > 0 ? '  ' : ''}${row.worktree.id}`
          : row.type
  )
}

const rows = [
  header('pinned'),
  item('p1'),
  header('repo:a'),
  item('a1'),
  item('a1-child', 1),
  item('a2'),
  header('repo:b'),
  item('b1'),
  header('custom-section:x'),
  item('x1')
]

describe('capSidebarSections', () => {
  it('cuts a section after the limit, children included, and ends it with Show more', () => {
    expect(
      shape(capSidebarSections(rows, { limit: 1, expanded: new Set(), keepWorktreeId: null }))
    ).toEqual([
      'H pinned',
      'p1',
      'H repo:a',
      'a1',
      '  a1-child',
      'H repo:b',
      `more ${MAIN_SECTION_KEY} 2`,
      'H custom-section:x',
      'x1'
    ])
  })

  it('keeps every row of an expanded section and the active workspace', () => {
    expect(
      shape(
        capSidebarSections(rows, {
          limit: 1,
          expanded: new Set([MAIN_SECTION_KEY]),
          keepWorktreeId: null
        })
      )
    ).toContain('b1')
    expect(
      shape(capSidebarSections(rows, { limit: 1, expanded: new Set(), keepWorktreeId: 'b1' }))
    ).toEqual([
      'H pinned',
      'p1',
      'H repo:a',
      'a1',
      '  a1-child',
      'H repo:b',
      'b1',
      `more ${MAIN_SECTION_KEY} 1`,
      'H custom-section:x',
      'x1'
    ])
  })
})
