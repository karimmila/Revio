import React from 'react'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { RevioSettingRow, RevioSwitch } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

/** The experimental Big terminal mode and its "New tab preset" (lane gitpr). */
export function RevioBigTerminalRows(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const [preset, setPreset] = React.useState(settings.revioBigTerminalPreset ?? '')
  const label = translate('auto.components.revioLayout.settings.bigTerminal', 'Big terminal mode')
  return (
    <>
      <RevioSettingRow
        label={label}
        description={translate(
          'auto.components.revioLayout.settings.bigTerminalDescription',
          'Create big terminals in the center pane with ⌘⇧T.'
        )}
        control={
          <RevioSwitch
            label={label}
            checked={settings.revioBigTerminal === true}
            onChange={(checked) => update({ revioBigTerminal: checked })}
          />
        }
      />
      {settings.revioBigTerminal === true ? (
        <RevioSettingRow
          label={translate(
            'auto.components.revioLayout.settings.bigTerminalPreset',
            'New tab preset'
          )}
          description={translate(
            'auto.components.revioLayout.settings.bigTerminalPresetDescription',
            'Command to auto-run when creating a new terminal tab.'
          )}
          below={
            <Input
              value={preset}
              variant="code"
              className="h-7"
              spellCheck={false}
              placeholder={translate(
                'auto.components.revioLayout.settings.bigTerminalPresetPlaceholder',
                'e.g. claude'
              )}
              onChange={(event) => setPreset(event.target.value)}
              onBlur={() => update({ revioBigTerminalPreset: preset.trim() })}
            />
          }
        />
      ) : null}
    </>
  )
}
