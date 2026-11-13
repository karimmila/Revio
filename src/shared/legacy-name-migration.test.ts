import { describe, expect, it } from 'vitest'
import {
  LEGACY_NAME,
  migrateLegacySettingKeys,
  renamedLegacySettingKey,
  renamedLegacyStatusVisualId,
  withRenamedLegacyStatusVisuals,
  renamedLegacyStorageKey
} from './legacy-name-migration'

const legacy = (rest: string): string => `${LEGACY_NAME}${rest}`

describe('legacy setting keys', () => {
  it('renames only keys that start with the legacy name and a capital', () => {
    expect(renamedLegacySettingKey(legacy('Location'))).toBe('revioLocation')
    expect(renamedLegacySettingKey(legacy('Layout'))).toBe('revioLayout')
    expect(renamedLegacySettingKey(legacy(''))).toBeNull()
    expect(renamedLegacySettingKey(legacy('ish'))).toBeNull()
    expect(renamedLegacySettingKey('revioLocation')).toBeNull()
    expect(renamedLegacySettingKey('terminalFontSize')).toBeNull()
  })

  it('moves every legacy key, keeps its value and drops the old key', () => {
    const settings: Record<string, unknown> = {
      [legacy('Layout')]: true,
      [legacy('Location')]: 'cloud',
      [legacy('SidebarSections')]: [{ id: 's1', name: 'Mine' }],
      [legacy('DebugTools')]: false,
      terminalFontSize: 13
    }
    expect(migrateLegacySettingKeys(settings)).toBe(true)
    expect(settings).toEqual({
      revioLayout: true,
      revioLocation: 'cloud',
      revioSidebarSections: [{ id: 's1', name: 'Mine' }],
      revioDebugTools: false,
      terminalFontSize: 13
    })
  })

  it('keeps a value a newer build already saved under the new name', () => {
    const settings: Record<string, unknown> = {
      [legacy('Location')]: 'cloud',
      revioLocation: 'local'
    }
    expect(migrateLegacySettingKeys(settings)).toBe(true)
    expect(settings).toEqual({ revioLocation: 'local' })
  })

  it('reports no change for migrated or missing settings', () => {
    expect(migrateLegacySettingKeys({ revioLayout: true })).toBe(false)
    expect(migrateLegacySettingKeys(undefined)).toBe(false)
    expect(migrateLegacySettingKeys(null)).toBe(false)
  })
})

describe('legacy storage keys', () => {
  it('renames the fork keys, dotted or not, and leaves others alone', () => {
    expect(renamedLegacyStorageKey(`orca.${legacy('DockShare')}`)).toBe('orca.revioDockShare')
    expect(renamedLegacyStorageKey(`orca.${legacy('.lastCloudRepoId')}`)).toBe(
      'orca.revio.lastCloudRepoId'
    )
    expect(renamedLegacyStorageKey('orca.revioDockShare')).toBeNull()
    expect(renamedLegacyStorageKey(`orca.${legacy('ish')}`)).toBeNull()
    expect(renamedLegacyStorageKey('orca.sidebarWidth')).toBeNull()
  })
})

describe('legacy workspace status visuals', () => {
  it('renames the three legacy color and icon ids and nothing else', () => {
    expect(renamedLegacyStatusVisualId(legacy('-done'))).toBe('status-done')
    expect(renamedLegacyStatusVisualId(legacy('-review'))).toBe('status-review')
    expect(renamedLegacyStatusVisualId(legacy('-progress'))).toBe('status-progress')
    expect(renamedLegacyStatusVisualId(legacy('-other'))).toBe(legacy('-other'))
    expect(renamedLegacyStatusVisualId('emerald')).toBe('emerald')
    expect(renamedLegacyStatusVisualId(7)).toBe(7)
  })

  it('rewrites saved statuses and keeps their other fields and shape', () => {
    const saved = [
      { id: 'in-review', label: 'In review', color: legacy('-review'), icon: legacy('-review') },
      { id: 'todo', label: 'Backlog', color: 'neutral', icon: 'circle' },
      'junk'
    ]
    expect(withRenamedLegacyStatusVisuals(saved)).toEqual([
      { id: 'in-review', label: 'In review', color: 'status-review', icon: 'status-review' },
      { id: 'todo', label: 'Backlog', color: 'neutral', icon: 'circle' },
      'junk'
    ])
    expect(withRenamedLegacyStatusVisuals(undefined)).toBeUndefined()
  })
})
