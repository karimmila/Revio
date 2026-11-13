import { describe, expect, it } from 'vitest'
import { filterShortcutRows } from './revio-shortcut-rows'

const rows = [
  { id: 'a', title: 'Open Settings', group: 'Global', keys: '⌘,' },
  { id: 'b', title: 'Toggle theme', group: 'App', keys: '⌘⌥T' },
  { id: 'c', title: 'Unbound thing', group: 'App', keys: '' }
]

describe('filterShortcutRows', () => {
  it('matches every word and drops unbound actions', () => {
    expect(filterShortcutRows(rows, '').map((row) => row.id)).toEqual(['a', 'b'])
    expect(filterShortcutRows(rows, 'theme app').map((row) => row.id)).toEqual(['b'])
    expect(filterShortcutRows(rows, '⌘,').map((row) => row.id)).toEqual(['a'])
  })
})
