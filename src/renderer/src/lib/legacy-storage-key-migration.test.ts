import { describe, expect, it } from 'vitest'
import { LEGACY_NAME } from '../../../shared/legacy-name-migration'
import { migrateLegacyStorageKeys } from './legacy-storage-key-migration'

function memoryStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries))
  return {
    map,
    get length() {
      return map.size
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key)
  }
}

describe('migrateLegacyStorageKeys', () => {
  it('moves every legacy entry to its new key and removes the old one', () => {
    const storage = memoryStorage({
      [`orca.${LEGACY_NAME}DockTerminals`]: '{"w1":["t1"]}',
      [`orca.${LEGACY_NAME}.lastCloudRepoId`]: 'repo-1',
      [`orca.${LEGACY_NAME}RightColumnShare`]: '0.46',
      'orca.sidebarWidth': '300'
    })
    expect(migrateLegacyStorageKeys(storage)).toBe(3)
    expect(Object.fromEntries(storage.map)).toEqual({
      'orca.revioDockTerminals': '{"w1":["t1"]}',
      'orca.revio.lastCloudRepoId': 'repo-1',
      'orca.revioRightColumnShare': '0.46',
      'orca.sidebarWidth': '300'
    })
  })

  it('keeps an entry already under the new key', () => {
    const storage = memoryStorage({
      [`orca.${LEGACY_NAME}ViewedFiles`]: 'old',
      'orca.revioViewedFiles': 'new'
    })
    migrateLegacyStorageKeys(storage)
    expect(Object.fromEntries(storage.map)).toEqual({ 'orca.revioViewedFiles': 'new' })
  })

  it('does nothing once migrated', () => {
    const storage = memoryStorage({ 'orca.revioLastAction': 'a' })
    expect(migrateLegacyStorageKeys(storage)).toBe(0)
    expect(Object.fromEntries(storage.map)).toEqual({ 'orca.revioLastAction': 'a' })
  })
})
