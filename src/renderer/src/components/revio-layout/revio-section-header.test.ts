import { describe, expect, it } from 'vitest'
import { PINNED_GROUP_KEY } from '../../../../shared/sidebar-list/group-keys'
import { adjustRevioHeaderSize } from './revio-section-header'

const header = (key: string) => ({ type: 'header', key })
const item = { type: 'item' }

describe('adjustRevioHeaderSize', () => {
  it('folds every header except the label after the pins', () => {
    const rows = [header(PINNED_GROUP_KEY), item, header('repo:a'), item, header('repo:b')]
    expect(adjustRevioHeaderSize(rows, 0, 28, true)).toBe(0)
    expect(adjustRevioHeaderSize(rows, 2, 28, true)).toBe(32)
    expect(adjustRevioHeaderSize(rows, 4, 28, true)).toBe(0)
  })

  it('folds the first repository header when nothing is pinned', () => {
    expect(adjustRevioHeaderSize([header('repo:a'), item], 0, 28, true)).toBe(0)
  })

  it('leaves Orca sizes alone outside the workspace layout', () => {
    expect(adjustRevioHeaderSize([header(PINNED_GROUP_KEY)], 0, 28, false)).toBe(28)
  })
})

describe('custom sections', () => {
  it('gives a custom section header the label height and keeps My workspaces after the pins', () => {
    const rows = [
      header(PINNED_GROUP_KEY),
      item,
      header('repo:a'),
      item,
      header('custom-section:ideas')
    ]
    expect(adjustRevioHeaderSize(rows, 2, 28, true)).toBe(32)
    expect(adjustRevioHeaderSize(rows, 4, 28, true)).toBe(32)
  })
})
