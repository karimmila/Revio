import type React from 'react'
import { translate } from '@/i18n/i18n'
import { RevioSettingRow, RevioSwitch } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

/** The experimental "Auto-run after setup" (lane gitpr). */
export function RevioAutoRunAfterSetupRow(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const label = translate(
    'auto.components.revioLayout.settings.autoRunAfterSetup',
    'Auto-run after setup'
  )
  return (
    <RevioSettingRow
      label={label}
      description={translate(
        'auto.components.revioLayout.settings.autoRunAfterSetupDescription',
        "Start a repository's default action automatically after a new local workspace finishes setup."
      )}
      control={
        <RevioSwitch
          label={label}
          checked={settings.revioAutoRunAfterSetup === true}
          onChange={(checked) => update({ revioAutoRunAfterSetup: checked })}
        />
      }
    />
  )
}
