import { describe, expect, it } from 'vitest'
import type { Row } from '../../../../shared/sidebar-list/row-types'
import type { AsleepCloudWorkspace } from '../../../../shared/asleep-cloud-workspace-types'
import { asleepCloudForLocation, withAsleepCloudRows } from './revio-asleep-cloud-rows'

function record(id: string, at: string): AsleepCloudWorkspace {
  return {
    id,
    repoId: 'repo-1',
    displayName: id,
    branch: `me/${id}`,
    commit: 'a'.repeat(40),
    chats: [],
    lastActivityAt: at
  }
}

const header = (key: string): Row => ({ type: 'header', key, count: 0, icon: { kind: 'all' } })

describe('asleep imported cloud rows', () => {
  it('are listed only in the Cloud location of the workspace layout', () => {
    const records = [record('a', '2026-11-01')]
    expect(asleepCloudForLocation(records, true, 'cloud')).toBe(records)
    expect(asleepCloudForLocation(records, true, 'local')).toEqual([])
    expect(asleepCloudForLocation(records, false, 'cloud')).toEqual([])
  })

  it('go after the main list, newest first, before the person’s own sections', () => {
    const rows = [header('all'), header('custom-section:s1')]
    const result = withAsleepCloudRows(
      rows,
      [record('old', '2026-10-01'), record('new', '2026-11-01')],
      new Map()
    )
    expect(result.map((row) => ('key' in row ? row.key : null))).toEqual([
      'all',
      'asleep-cloud:new',
      'asleep-cloud:old',
      'custom-section:s1'
    ])
    expect(result[1]).toMatchObject({ type: 'pending-creation', asleepCloud: { id: 'new' } })
    expect(withAsleepCloudRows(rows, [], new Map())).toBe(rows)
  })
})
