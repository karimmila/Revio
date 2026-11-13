import React from 'react'
import { AppWindow } from 'lucide-react'
import type { OpenInApplication } from '../../../shared/ui-chrome-types'
import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { BUILT_IN_EDITOR_COMMANDS } from '../../../shared/open-in-applications'
import { MAC_OPEN_IN_APPS, macOpenInCommand } from '../../../shared/open-in-mac-apps'

export type OpenInAppPreset = {
  id: string
  label: string
  command: string
}

export const getOpenInAppPresets = createLocalizedCatalog(() => [
  {
    id: 'vscode',
    label: translate('auto.lib.open.in.app.catalog.173553f73a', 'VS Code'),
    command: BUILT_IN_EDITOR_COMMANDS.vscode
  },
  {
    id: 'cursor',
    label: translate('auto.lib.open.in.app.catalog.d62b12e98a', 'Cursor'),
    command: BUILT_IN_EDITOR_COMMANDS.cursor
  },
  {
    id: 'zed',
    label: translate('auto.lib.open.in.app.catalog.f8b8ca2711', 'Zed'),
    command: BUILT_IN_EDITOR_COMMANDS.zed
  },
  {
    id: 'devin-desktop',
    label: translate('settings.openInApp.preset.devinDesktop', 'Devin Desktop'),
    command: BUILT_IN_EDITOR_COMMANDS['devin-desktop']
  },
  {
    id: 'antigravity-ide',
    label: translate('settings.openInApp.preset.antigravityIde', 'Antigravity IDE'),
    command: BUILT_IN_EDITOR_COMMANDS['antigravity-ide']
  },
  ...(navigator.userAgent.includes('Mac')
    ? MAC_OPEN_IN_APPS.map((app) => ({
        id: app.id,
        label: app.label,
        command: macOpenInCommand(app.app)
      }))
    : [])
])

export function getOpenInAppPreset(
  application: Pick<OpenInApplication, 'command'>
): OpenInAppPreset | null {
  const command = application.command.trim().toLowerCase()
  return getOpenInAppPresets().find((preset) => preset.command.toLowerCase() === command) ?? null
}

export function isOpenInAppPresetAdded(
  applications: readonly Pick<OpenInApplication, 'command'>[],
  preset: OpenInAppPreset
): boolean {
  return applications.some(
    (application) => application.command.trim().toLowerCase() === preset.command.toLowerCase()
  )
}

let presetIcons: Readonly<Record<string, string>> = {}
let presetIconsRequested = false
const presetIconListeners = new Set<() => void>()

/** Asks main once for the installed apps' own icons; they change only when an app is installed. */
function subscribeToPresetIcons(listener: () => void): () => void {
  presetIconListeners.add(listener)
  if (!presetIconsRequested) {
    presetIconsRequested = true
    void window.api.shell
      .readOpenInPresetIcons?.()
      .then((icons) => {
        presetIcons = icons
        for (const notify of presetIconListeners) {
          notify()
        }
      })
      .catch(() => {})
  }
  return () => presetIconListeners.delete(listener)
}

/** An app's icon comes from its bundle on this Mac; an app that is not installed gets a glyph. */
export function OpenInApplicationIcon({
  application,
  size = 14
}: {
  application: Pick<OpenInApplication, 'command'>
  size?: number
}): React.JSX.Element {
  const icons = React.useSyncExternalStore(subscribeToPresetIcons, () => presetIcons)
  const preset = getOpenInAppPreset(application)
  const icon = preset ? icons[preset.id] : undefined
  if (icon) {
    return (
      <img
        src={icon}
        width={size}
        height={size}
        alt=""
        aria-hidden
        className="shrink-0"
        style={{ borderRadius: 2 }}
      />
    )
  }
  return <AppWindow width={size} height={size} />
}
