import { useAppStore } from '@/store'
import type { GlobalSettings } from '../../../../../shared/global-settings-types'

/** The loaded settings and the writer Orca's own settings page uses, so both pages stay in sync. */
export function useRevioSettings(): {
  settings: GlobalSettings
  update: (updates: Partial<GlobalSettings>) => void
} {
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  if (!settings) {
    throw new Error('Workspace layout settings rendered before settings loaded')
  }
  return { settings, update: (updates) => void updateSettings(updates) }
}
