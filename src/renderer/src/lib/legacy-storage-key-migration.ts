import { renamedLegacyStorageKey } from '../../../shared/legacy-name-migration'

type KeyedStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>

/**
 * Moves the fork's browser-storage entries saved under their legacy names to the new names, once.
 * An entry already under the new name wins. Must run before any module reads these keys.
 */
export function migrateLegacyStorageKeys(storage: KeyedStorage): number {
  const legacyKeys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key !== null && renamedLegacyStorageKey(key) !== null) {
      legacyKeys.push(key)
    }
  }
  for (const key of legacyKeys) {
    const next = renamedLegacyStorageKey(key)
    const value = storage.getItem(key)
    if (next !== null && value !== null && storage.getItem(next) === null) {
      storage.setItem(next, value)
    }
    storage.removeItem(key)
  }
  return legacyKeys.length
}

export function migrateLegacyBrowserStorage(): void {
  for (const read of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      migrateLegacyStorageKeys(read())
    } catch {
      // Storage can be unavailable (blocked or a sandboxed preview); the app then starts fresh.
    }
  }
}
