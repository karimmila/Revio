import type React from 'react'
import { translate } from '@/i18n/i18n'
import { RevioSettingRow, RevioSwitch } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

/** The Experimental "Tab Freak Mode" and "Split tabs". Split tabs stays on by default
 * here because Orca's center always splits; turning it off brings back the workspace layout's tab
 * cap. */
export function RevioTabRows(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const freak = translate('auto.components.revioLayout.settings.tabFreakMode', 'Tab Freak Mode')
  const split = translate('auto.components.revioLayout.settings.splitTabs', 'Split tabs')
  return (
    <>
      <RevioSettingRow
        label={freak}
        description={translate(
          'auto.components.revioLayout.settings.tabFreakModeDescription',
          'Allow up to 10 chat and terminal tabs per workspace.'
        )}
        control={
          <RevioSwitch
            label={freak}
            checked={settings.revioTabFreakMode === true}
            onChange={(checked) => update({ revioTabFreakMode: checked })}
          />
        }
      />
      <RevioSettingRow
        label={split}
        description={translate(
          'auto.components.revioLayout.settings.splitTabsDescription',
          'Split the center panel and move tabs between panes. While off, a workspace holds at most 5 chat and terminal tabs (10 with Tab Freak Mode).'
        )}
        control={
          <RevioSwitch
            label={split}
            checked={settings.revioSplitTabs !== false}
            onChange={(checked) => update({ revioSplitTabs: checked })}
          />
        }
      />
    </>
  )
}
