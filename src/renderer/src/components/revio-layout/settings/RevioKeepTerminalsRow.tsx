import type React from 'react'
import { translate } from '@/i18n/i18n'
import { RevioSettingRow, RevioSwitch } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

/** Advanced: Quit leaves terminals and what runs in them going, to reattach at the next launch. */
export function RevioKeepTerminalsRow(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const label = translate(
    'auto.components.revioLayout.settings.keepTerminals',
    'Keep terminals running after quit'
  )
  return (
    <RevioSettingRow
      label={label}
      description={translate(
        'auto.components.revioLayout.settings.keepTerminalsDescription',
        'When off, quitting {{productName}} stops every terminal and the programs running in them. When on, they keep running in the background and are there again at the next launch.'
      )}
      control={
        <RevioSwitch
          label={label}
          checked={settings.revioKeepTerminalsAfterQuit === true}
          onChange={(checked) => update({ revioKeepTerminalsAfterQuit: checked })}
        />
      }
    />
  )
}
