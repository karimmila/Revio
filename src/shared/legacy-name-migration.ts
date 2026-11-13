/**
 * Builds before 2026-11-10 stored the fork's settings, browser-storage keys and archive folder
 * under the name of the app whose layout the fork follows. This module is the one place that
 * still spells that name, so data those builds saved keeps loading under the new names. Drop it
 * once no install can still hold the old names.
 */
export const LEGACY_NAME = 'conductor'
const CURRENT_NAME = 'revio'

const LEGACY_SETTING_KEY = new RegExp(`^${LEGACY_NAME}(?=[A-Z])`)
const LEGACY_STORAGE_KEY = new RegExp(`^orca\\.${LEGACY_NAME}(?=[A-Z.])`)

/** `<legacy>Location` → `revioLocation`; null for any other key. */
export function renamedLegacySettingKey(key: string): string | null {
  return LEGACY_SETTING_KEY.test(key) ? key.replace(LEGACY_SETTING_KEY, CURRENT_NAME) : null
}

/** `orca.<legacy>DockShare` → `orca.revioDockShare`, `orca.<legacy>.x` → `orca.revio.x`; else null. */
export function renamedLegacyStorageKey(key: string): string | null {
  return LEGACY_STORAGE_KEY.test(key)
    ? key.replace(LEGACY_STORAGE_KEY, `orca.${CURRENT_NAME}`)
    : null
}

/**
 * Moves legacy settings keys to their new names in place and drops the old ones. A value already
 * saved under the new name wins, since only a newer build writes it. Returns whether anything
 * changed, so the caller can save the migrated settings once.
 */
export function migrateLegacySettingKeys(
  settings: Record<string, unknown> | null | undefined
): boolean {
  if (!settings) {
    return false
  }
  let changed = false
  for (const [key, value] of Object.entries(settings)) {
    const next = renamedLegacySettingKey(key)
    if (next === null) {
      continue
    }
    if (!Object.hasOwn(settings, next)) {
      Reflect.set(settings, next, value)
    }
    Reflect.deleteProperty(settings, key)
    changed = true
  }
  return changed
}

const LEGACY_STATUS_VISUAL_ID = new RegExp(`^${LEGACY_NAME}-(done|review|progress)$`)

/** A workspace status color or icon id saved before 2026-11-10: `<legacy>-done` → `status-done`. */
export function renamedLegacyStatusVisualId(id: unknown): unknown {
  return typeof id === 'string' ? id.replace(LEGACY_STATUS_VISUAL_ID, 'status-$1') : id
}

/**
 * Raw saved workspace statuses with legacy color and icon ids renamed, so the default-payload
 * checks and the normalizer only ever see the new ids. Anything else passes through unchanged.
 */
export function withRenamedLegacyStatusVisuals(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value
  }
  return value.map((entry: unknown) => {
    if (!isRecord(entry)) {
      return entry
    }
    const color = renamedLegacyStatusVisualId(entry.color)
    const icon = renamedLegacyStatusVisualId(entry.icon)
    return color === entry.color && icon === entry.icon ? entry : { ...entry, color, icon }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
