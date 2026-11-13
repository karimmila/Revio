import { describe, expect, it } from 'vitest'
import { DEFAULT_WORKSPACE_STATUSES } from '../../../../shared/workspace-statuses'
import { groupHomeRows } from './revio-home-groups'

function row(id: string, repoId: string, workspaceStatus?: string) {
  return { id, repoId, workspaceStatus }
}

const statuses = DEFAULT_WORKSPACE_STATUSES.map((status) => ({ ...status }))
const names = new Map([
  ['r1', 'zeta'],
  ['r2', 'alpha']
])
const rows = [row('a', 'r1', 'completed'), row('b', 'r2'), row('c', 'r1', 'todo')]

describe('groupHomeRows', () => {
  it('keeps one unlabeled group without grouping', () => {
    expect(groupHomeRows(rows, 'none', statuses, names)).toEqual([
      { key: 'all', label: null, rows }
    ])
  })

  it('groups by status in the status order, defaulting unset rows', () => {
    const groups = groupHomeRows(rows, 'status', statuses, names)
    expect(groups.map((g) => [g.label, g.rows.map((r) => r.id)])).toEqual([
      ['Backlog', ['c']],
      ['In progress', ['b']],
      ['Done', ['a']]
    ])
  })

  it('groups by project name', () => {
    const groups = groupHomeRows(rows, 'project', statuses, names)
    expect(groups.map((g) => [g.label, g.rows.map((r) => r.id)])).toEqual([
      ['alpha', ['b']],
      ['zeta', ['a', 'c']]
    ])
  })
})
