import type React from 'react'
import { translate } from '@/i18n/i18n'
import { RevioSettingRow, RevioSwitch } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

/** Advanced: lets Help > Open debug tools open the window's developer tools in a packaged build. */
export function RevioDebugToolsRow(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const label = translate('auto.components.revioLayout.settings.debugTools', 'Allow debug tools')
  return (
    <RevioSettingRow
      label={label}
      description={translate(
        'auto.components.revioLayout.settings.debugToolsNote',
        'Turn on Help > Open debug tools and View > Toggle Developer Tools, and let {{productName}} start with remote debugging switches from its next launch. Debug tools can read everything in the window, including signed-in sessions. Turn them on only while you need them.'
      )}
      control={
        <RevioSwitch
          label={label}
          checked={settings.revioDebugTools === true}
          onChange={(checked) => update({ revioDebugTools: checked })}
        />
      }
    />
  )
}
