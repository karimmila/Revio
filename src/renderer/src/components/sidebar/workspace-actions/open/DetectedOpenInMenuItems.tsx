import React, { useEffect, useState } from 'react'
import { DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import {
  getOpenInAppPresets,
  isOpenInAppPresetAdded,
  OpenInApplicationIcon,
  type OpenInAppPreset
} from '@/lib/open-in-app-catalog'
import { NO_OPEN_IN_APPLICATIONS } from '@/lib/open-in-application-selection'
import { createPresetOpenInApplication } from '@/components/settings/general/OpenInMenuSetting'
import {
  OPEN_IN_APPLICATIONS_MAX,
  normalizeOpenInApplications
} from '../../../../../../shared/open-in-applications'
import type { OpenInApplication } from '../../../../../../shared/ui-chrome-types'

let detection: Promise<ReadonlySet<string>> | null = null

/** Installed apps change rarely; one scan per app session is enough. */
function detectInstalledPresets(): Promise<ReadonlySet<string>> {
  detection ??= (window.api.shell.detectOpenInPresets?.() ?? Promise.resolve([])).then(
    (ids) => new Set(ids),
    () => new Set<string>()
  )
  return detection
}

/** Installed presets that are not in the Open in list yet, while the list has room. */
export function detectedPresetsToOffer(
  presets: readonly OpenInAppPreset[],
  detected: ReadonlySet<string>,
  applications: readonly Pick<OpenInApplication, 'command'>[]
): OpenInAppPreset[] {
  if (applications.length >= OPEN_IN_APPLICATIONS_MAX) {
    return []
  }
  return presets.filter(
    (preset) => detected.has(preset.id) && !isOpenInAppPresetAdded(applications, preset)
  )
}

/**
 * The workspace layout lists the apps it finds on the Mac. Orca keeps a saved list, so an installed
 * app that is not in it shows here; picking it adds it to the list and opens the folder in it.
 */
export function DetectedOpenInMenuItems({
  disabled,
  onOpen
}: {
  disabled?: boolean
  onOpen: (application: OpenInApplication) => void
}): React.JSX.Element | null {
  const [detected, setDetected] = useState<ReadonlySet<string>>(new Set())
  const applications = useAppStore((s) => s.settings?.openInApplications ?? NO_OPEN_IN_APPLICATIONS)
  useEffect(() => {
    let live = true
    void detectInstalledPresets().then((ids) => {
      if (live) {
        setDetected(ids)
      }
    })
    return () => {
      live = false
    }
  }, [])
  const offers = detectedPresetsToOffer(getOpenInAppPresets(), detected, applications)
  if (offers.length === 0) {
    return null
  }
  const add = async (preset: OpenInAppPreset): Promise<void> => {
    const application = createPresetOpenInApplication(preset)
    await useAppStore.getState().updateSettings({
      openInApplications: normalizeOpenInApplications([...applications, application])
    })
    onOpen(application)
  }
  return (
    <>
      <DropdownMenuLabel>
        {translate('auto.components.sidebar.WorktreeOpenInMenu.installedApps', 'Installed apps')}
      </DropdownMenuLabel>
      {offers.map((preset) => (
        <DropdownMenuItem
          key={preset.id}
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          onSelect={() => void add(preset)}
        >
          <OpenInApplicationIcon application={{ command: preset.command }} size={14} />
          <span className="min-w-0 truncate">{preset.label}</span>
        </DropdownMenuItem>
      ))}
    </>
  )
}
