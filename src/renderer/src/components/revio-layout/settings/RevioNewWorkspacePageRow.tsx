import { translate } from '@/i18n/i18n'
import { RevioSettingRow, RevioSwitch } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

/** The experimental "New workspace page": Create opens as a full page, not a modal. */
export function RevioNewWorkspacePageRow(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const label = translate(
    'auto.components.revioLayout.settings.newWorkspacePage',
    'New workspace page'
  )
  return (
    <RevioSettingRow
      label={label}
      description={translate(
        'auto.components.revioLayout.settings.newWorkspacePageDescription',
        'Full-screen workspace creation'
      )}
      control={
        <RevioSwitch
          label={label}
          checked={settings.revioNewWorkspacePage === true}
          onChange={(checked) => update({ revioNewWorkspacePage: checked })}
        />
      }
    />
  )
}
