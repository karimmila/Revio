import { app } from 'electron'
import inspector from 'node:inspector'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { getCanonicalUserDataPath } from '../persistence/loading-store/user-data-path'
import {
  applyDebugSwitchPolicy,
  readDebugToolsAllowedMarker,
  writeDebugToolsAllowedMarker
} from './debug-switch-policy'

/** Before `ready`, once the profile folder is known. */
export function applyPackagedDebugSwitchPolicy(userDataPath: string): void {
  if (!app.isPackaged) {
    return
  }
  applyDebugSwitchPolicy({
    isPackaged: app.isPackaged,
    argv: process.argv,
    debugToolsAllowed: readDebugToolsAllowedMarker(userDataPath),
    commandLine: app.commandLine,
    closeInspector: () => inspector.close(),
    warn: (message) => console.warn(message)
  })
}

type DebugToolsSettingStore = {
  getSettings: () => Pick<GlobalSettings, 'revioDebugTools'>
  onSettingsChanged: (listener: (updates: Partial<GlobalSettings>) => void) => unknown
}

/** Keeps the pre-`ready` marker equal to the saved setting, for the next launch. */
export function followDebugToolsSetting(store: DebugToolsSettingStore): void {
  const save = (): void =>
    writeDebugToolsAllowedMarker(
      getCanonicalUserDataPath(),
      store.getSettings().revioDebugTools === true
    )
  save()
  store.onSettingsChanged((updates) => {
    if ('revioDebugTools' in updates) {
      save()
    }
  })
}
