import { describe, expect, it } from 'vitest'
import { ACTION_ICONS, isActionIcon, searchActionIcons } from './action-icons'

describe('action icons', () => {
  it('lists every icon for an empty search', () => {
    expect(searchActionIcons('  ')).toHaveLength(ACTION_ICONS.length)
  })

  it('matches names, labels and keywords, every word', () => {
    expect(searchActionIcons('deploy').map((icon) => icon.id)).toEqual(['rocket', 'cloud'])
    expect(searchActionIcons('TEST lab').map((icon) => icon.id)).toEqual(['flask-conical'])
    expect(searchActionIcons('nothing-like-this')).toEqual([])
  })

  it('knows its own ids only', () => {
    expect(isActionIcon('rocket')).toBe(true)
    expect(isActionIcon('not-an-icon')).toBe(false)
    expect(isActionIcon(undefined)).toBe(false)
  })
})
