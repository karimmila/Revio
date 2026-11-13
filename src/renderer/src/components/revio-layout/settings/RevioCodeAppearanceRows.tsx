import React from 'react'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { CodeEditorThemeSelect } from '@/components/settings/appearance/themes/AppearanceThemeControl'
import { RevioSettingRow, RevioSwitch } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

function MonoFontControl(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const saved = settings.editorFontFamily ?? ''
  const [draft, setDraft] = React.useState(saved)
  const commit = (): void => {
    if (draft.trim() !== saved) {
      update({ editorFontFamily: draft.trim() })
    }
  }
  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit()
        }
      }}
      placeholder={translate(
        'auto.components.revioLayout.settings.monoFontPlaceholder',
        'Same as the terminal font'
      )}
      aria-label={translate('auto.components.revioLayout.settings.monoFont', 'Mono font')}
      className="h-8 w-64"
    />
  )
}

/** The Code theme and Mono font rows, written to Orca's editor theme and font settings. */
export function RevioCodeAppearanceRows(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const darkLabel = translate(
    'auto.components.revioLayout.settings.codeThemeDark',
    'Code theme (dark)'
  )
  const lightLabel = translate(
    'auto.components.revioLayout.settings.codeThemeLight',
    'Code theme (light)'
  )
  const lowContrastLabel = translate(
    'auto.components.revioLayout.settings.lowContrast',
    'Low-contrast dark mode'
  )
  const colorVisionLabel = translate(
    'auto.components.revioLayout.settings.colorVision',
    'Accessible colors'
  )
  const coloredDiffsLabel = translate(
    'auto.components.revioLayout.settings.coloredSidebarDiffs',
    'Colored sidebar diffs'
  )
  return (
    <>
      <RevioSettingRow
        label={coloredDiffsLabel}
        description={translate(
          'auto.components.revioLayout.settings.coloredSidebarDiffsDescription',
          'Always show line change colors in the sidebar, even for unselected workspaces.'
        )}
        control={
          <RevioSwitch
            label={coloredDiffsLabel}
            checked={settings.revioColoredSidebarDiffs === true}
            onChange={(checked) => update({ revioColoredSidebarDiffs: checked })}
          />
        }
      />
      <RevioSettingRow
        label={lowContrastLabel}
        description={translate(
          'auto.components.revioLayout.settings.lowContrastDescription',
          "Soften the app's colors when using the dark theme."
        )}
        control={
          <RevioSwitch
            label={lowContrastLabel}
            checked={settings.revioLowContrastDark === true}
            onChange={(checked) => update({ revioLowContrastDark: checked })}
          />
        }
      />
      <RevioSettingRow
        label={colorVisionLabel}
        description={translate(
          'auto.components.revioLayout.settings.colorVisionDescription',
          'Theme optimized for color vision differences.'
        )}
        control={
          <RevioSwitch
            label={colorVisionLabel}
            checked={settings.revioAccessibleColors === true}
            onChange={(checked) => update({ revioAccessibleColors: checked })}
          />
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.codeTheme', 'Code theme')}
        description={translate(
          'auto.components.revioLayout.settings.codeThemeDescription',
          'Syntax highlighting theme for code and diffs.'
        )}
        control={
          <div className="flex flex-col items-end gap-2">
            <CodeEditorThemeSelect
              base="dark"
              label={darkLabel}
              settings={settings}
              updateSettings={update}
            />
            <CodeEditorThemeSelect
              base="light"
              label={lightLabel}
              settings={settings}
              updateSettings={update}
            />
          </div>
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.monoFont', 'Mono font')}
        description={translate(
          'auto.components.revioLayout.settings.monoFontDescription',
          'Font used for code and diffs.'
        )}
        control={<MonoFontControl />}
      />
    </>
  )
}
