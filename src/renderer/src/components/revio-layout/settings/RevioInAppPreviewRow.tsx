import type React from 'react'
import { translate } from '@/i18n/i18n'
import { RevioSettingRow, RevioSwitch } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

/** The experimental "In-app browser preview" (lane gitflow). */
export function RevioInAppPreviewRow(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const label = translate(
    'auto.components.revioLayout.settings.inAppPreview',
    'In-app browser preview'
  )
  return (
    <RevioSettingRow
      label={label}
      description={translate(
        'auto.components.revioLayout.settings.inAppPreviewDescription',
        'Open the preview button in an in-app browser tab instead of your external browser.'
      )}
      control={
        <RevioSwitch
          label={label}
          checked={settings.revioInAppBrowserPreview === true}
          onChange={(checked) => update({ revioInAppBrowserPreview: checked })}
        />
      }
    />
  )
}
