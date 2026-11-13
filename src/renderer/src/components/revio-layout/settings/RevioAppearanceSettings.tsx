import React from 'react'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  RevioKeys,
  RevioSelect,
  RevioSettingRow,
  RevioSettingsPage,
  RevioSwitch
} from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'
import { RevioZoomControl } from './RevioZoomControl'
import { RevioCodeAppearanceRows } from './RevioCodeAppearanceRows'

const TERMINAL_FONT_SIZE_MIN = 10
const TERMINAL_FONT_SIZE_MAX = 24

function TerminalFontControl(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const [draft, setDraft] = React.useState(settings.terminalFontFamily)
  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => update({ terminalFontFamily: draft.trim() })}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          update({ terminalFontFamily: draft.trim() })
        }
      }}
      placeholder={translate(
        'auto.components.revioLayout.settings.fontPlaceholder',
        'Leave empty for default'
      )}
      aria-label={translate('auto.components.revioLayout.settings.terminalFont', 'Terminal font')}
      className="h-8 w-64"
    />
  )
}

export function RevioAppearanceSettings(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  return (
    <RevioSettingsPage
      title={translate('auto.components.revioLayout.settings.appearance', 'Appearance')}
    >
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.theme', 'Theme')}
        control={
          <RevioSelect
            label={translate('auto.components.revioLayout.settings.theme', 'Theme')}
            value={settings.theme}
            options={[
              {
                value: 'system',
                label: translate('auto.components.revioLayout.settings.themeSystem', 'System')
              },
              {
                value: 'dark',
                label: translate('auto.components.revioLayout.settings.themeDark', 'Dark')
              },
              {
                value: 'light',
                label: translate('auto.components.revioLayout.settings.themeLight', 'Light')
              }
            ]}
            onChange={(theme) => update({ theme })}
          />
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.zoom', 'App zoom')}
        hint={
          <>
            {translate('auto.components.revioLayout.settings.zoomHintStart', 'Adjust with')}{' '}
            <RevioKeys keys="⌘-" />{' '}
            {translate('auto.components.revioLayout.settings.zoomHintOut', '(zoom out) or')}{' '}
            <RevioKeys keys="⌘+" />{' '}
            {translate('auto.components.revioLayout.settings.zoomHintIn', '(zoom in)')}
          </>
        }
        control={<RevioZoomControl />}
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.ligatures', 'Code ligatures')}
        description={translate(
          'auto.components.revioLayout.settings.ligaturesDescription',
          'Use font ligatures in file editors, diffs and terminals.'
        )}
        control={
          <RevioSwitch
            label={translate('auto.components.revioLayout.settings.ligatures', 'Code ligatures')}
            checked={settings.terminalLigatures !== 'off'}
            onChange={(checked) =>
              update({
                terminalLigatures: checked ? 'on' : 'off',
                editorLigatures: checked ? 'on' : 'off'
              })
            }
          />
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.diffView', 'Diff view')}
        description={translate(
          'auto.components.revioLayout.settings.diffViewDescription',
          'How a file diff opens. The diff toolbar switches it for the open file.'
        )}
        control={
          <RevioSelect
            label={translate('auto.components.revioLayout.settings.diffView', 'Diff view')}
            value={settings.diffDefaultView}
            options={[
              {
                value: 'side-by-side',
                label: translate('auto.components.revioLayout.settings.diffSplit', 'Side by side')
              },
              {
                value: 'inline',
                label: translate('auto.components.revioLayout.settings.diffInline', 'Inline')
              }
            ]}
            onChange={(diffDefaultView) => update({ diffDefaultView })}
          />
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.markdownOpen', 'Open markdown as')}
        description={translate(
          'auto.components.revioLayout.settings.markdownDescription',
          'How markdown files open.'
        )}
        control={
          <RevioSelect
            label={translate(
              'auto.components.revioLayout.settings.markdownOpen',
              'Open markdown as'
            )}
            value={settings.markdownDefaultViewMode ?? 'rich'}
            options={[
              {
                value: 'rich',
                label: translate('auto.components.revioLayout.settings.markdownRich', 'Rendered')
              },
              {
                value: 'source',
                label: translate('auto.components.revioLayout.settings.markdownSource', 'Source')
              }
            ]}
            onChange={(markdownDefaultViewMode) => update({ markdownDefaultViewMode })}
          />
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.markdown', 'Markdown style')}
        description={translate(
          'auto.components.revioLayout.settings.markdownStyleDescription',
          'Rendering style for markdown files.'
        )}
        control={
          <RevioSelect
            label={translate('auto.components.revioLayout.settings.markdown', 'Markdown style')}
            value={settings.revioMarkdownStyle ?? 'default'}
            options={[
              {
                value: 'default',
                label: translate('auto.components.revioLayout.settings.markdownDefault', 'Default')
              },
              {
                value: 'tufte',
                label: translate('auto.components.revioLayout.settings.markdownTufte', 'Tufte')
              }
            ]}
            onChange={(revioMarkdownStyle) => update({ revioMarkdownStyle })}
          />
        }
      />
      <RevioCodeAppearanceRows />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.terminalFont', 'Terminal font')}
        description={translate(
          'auto.components.revioLayout.settings.terminalFontDescription',
          'Enter the font name exactly as installed, e.g. FiraCode Nerd Font.'
        )}
        control={<TerminalFontControl />}
      />
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.terminalFontSize',
          'Terminal font size'
        )}
        control={
          <div className="flex w-64 items-center gap-3">
            <span data-revio-settings-status="" className="w-9 shrink-0 tabular-nums">
              {translate('auto.components.revioLayout.settings.pixels', '{{value0}}px', {
                value0: settings.terminalFontSize
              })}
            </span>
            <Slider
              value={[settings.terminalFontSize]}
              min={TERMINAL_FONT_SIZE_MIN}
              max={TERMINAL_FONT_SIZE_MAX}
              step={1}
              onValueChange={([size]) => {
                if (size !== undefined) {
                  update({ terminalFontSize: size })
                }
              }}
              aria-label={translate(
                'auto.components.revioLayout.settings.terminalFontSize',
                'Terminal font size'
              )}
            />
          </div>
        }
      />
    </RevioSettingsPage>
  )
}
