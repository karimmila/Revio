import type React from 'react'
import type { GlobalSettings } from '../../../../../shared/global-settings-types'
import { SearchableSetting } from '../section-layout/SearchableSetting'
import { SettingsSwitchRow } from '../form-controls/SettingsFormControls'
import { translate } from '@/i18n/i18n'

function SwitchSetting({
  title,
  description,
  keywords,
  checked,
  onToggle
}: {
  title: string
  description: string
  keywords: string[]
  checked: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <SearchableSetting title={title} description={description} keywords={keywords}>
      <SettingsSwitchRow
        label={title}
        description={description}
        checked={checked}
        onChange={onToggle}
      />
    </SearchableSetting>
  )
}

/** The fork's switches: the prompt-first dialog and the workspace layout. */
export function PromptFirstComposerSetting({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  return (
    <>
      <SwitchSetting
        title={translate(
          'auto.components.settings.AppearancePane.promptFirstComposer',
          'Prompt-First New Workspace'
        )}
        description={translate(
          'auto.components.settings.AppearancePane.promptFirstComposerDescription',
          'Lead the new-workspace dialog with a prompt for the agent. Create From moves under Advanced.'
        )}
        keywords={['prompt', 'new workspace', 'create', 'composer']}
        checked={settings.promptFirstWorkspaceComposer === true}
        onToggle={() =>
          updateSettings({
            promptFirstWorkspaceComposer: settings.promptFirstWorkspaceComposer !== true
          })
        }
      />
      <SwitchSetting
        title={translate(
          'auto.components.settings.AppearancePane.workspaceLayout',
          'Workspace Layout'
        )}
        description={translate(
          'auto.components.settings.AppearancePane.revioLayoutDescription',
          'Text tabs on the right, Create and Search at the top of the sidebar, and line totals on each workspace.'
        )}
        keywords={['layout', 'tabs', 'sidebar', 'simple']}
        checked={settings.revioLayout === true}
        onToggle={() => updateSettings({ revioLayout: settings.revioLayout !== true })}
      />
    </>
  )
}
