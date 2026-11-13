import React from 'react'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { WorkspaceDirectorySetting } from '@/components/settings/general/WorkspaceDirectorySetting'
import { PrivacyDiagnosticsSection } from '@/components/settings/privacy/PrivacyDiagnosticsSection'
import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'
import {
  DESKTOP_TERMINAL_SCROLLBACK_ROW_PRESETS,
  normalizeDesktopTerminalScrollbackRows
} from '../../../../../shared/terminal/replay/terminal-scrollback-policy'
import {
  RevioSelect,
  RevioSettingRow,
  RevioSettingsGroup,
  RevioSettingsPage
} from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'
import { RevioSshKeyPathRow } from './RevioSshKeyPathRow'
import { RevioDebugToolsRow } from './RevioDebugToolsRow'
import { RevioKeepTerminalsRow } from './RevioKeepTerminalsRow'
import { RevioGithubAppRow } from './RevioGithubAppRow'
import { scrollbackChoices, withAgentCommandOverride } from './revio-advanced-values'

function ExecutablePathRow({
  agent,
  label
}: {
  agent: TuiAgent
  label: string
}): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const saved = settings.agentCmdOverrides[agent] ?? ''
  const [draft, setDraft] = React.useState(saved)
  const commit = (): void => {
    if (draft.trim() !== saved) {
      update({
        agentCmdOverrides: withAgentCommandOverride(settings.agentCmdOverrides, agent, draft)
      })
    }
  }
  return (
    <RevioSettingRow
      label={label}
      description={translate(
        'auto.components.revioLayout.settings.executableDescription',
        'Override the command {{productName}} starts with a custom executable. Leave empty to use the default (recommended).'
      )}
      control={
        <Input
          key={saved}
          value={draft}
          placeholder={agent}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commit()
            }
          }}
          aria-label={label}
          variant="code"
          className="h-8 w-64"
        />
      }
    />
  )
}

function ScrollbackRow(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const rows = normalizeDesktopTerminalScrollbackRows(settings.terminalScrollbackRows)
  const label = translate('auto.components.revioLayout.settings.scrollback', 'Scrollback limit')
  return (
    <RevioSettingRow
      label={label}
      description={translate(
        'auto.components.revioLayout.settings.scrollbackDescription',
        'Approximate terminal output to keep.'
      )}
      control={
        <RevioSelect
          label={label}
          value={String(rows)}
          options={scrollbackChoices(DESKTOP_TERMINAL_SCROLLBACK_ROW_PRESETS, rows).map(
            (count) => ({
              value: String(count),
              label: translate(
                'auto.components.revioLayout.settings.scrollbackLines',
                '{{value0}} lines',
                {
                  value0: count.toLocaleString(getIntlLocale())
                }
              )
            })
          )}
          onChange={(next) =>
            update({ terminalScrollbackRows: normalizeDesktopTerminalScrollbackRows(Number(next)) })
          }
        />
      }
    />
  )
}

/** The Advanced page: where workspaces live, agent executables, scrollback, diagnostics. */
export function RevioAdvancedSettings(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  return (
    <RevioSettingsPage
      title={translate('auto.components.revioLayout.settings.advanced', 'Advanced')}
    >
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.rootDirectory', 'Root directory')}
        description={translate(
          'auto.components.revioLayout.settings.rootDirectoryDescription',
          "Where new workspaces are created. Don't move or edit its folders directly."
        )}
        below={<WorkspaceDirectorySetting settings={settings} updateSettings={update} />}
      />
      <ExecutablePathRow
        agent="claude"
        label={translate(
          'auto.components.revioLayout.settings.claudePath',
          'Claude Code executable path'
        )}
      />
      <ExecutablePathRow
        agent="codex"
        label={translate('auto.components.revioLayout.settings.codexPath', 'Codex executable path')}
      />
      <ExecutablePathRow
        agent="opencode"
        label={translate(
          'auto.components.revioLayout.settings.opencodePath',
          'OpenCode executable path'
        )}
      />
      <ScrollbackRow />
      <RevioKeepTerminalsRow />
      <RevioSshKeyPathRow />
      <RevioGithubAppRow />
      <RevioSettingsGroup
        title={translate('auto.components.revioLayout.settings.diagnostics', 'Diagnostics')}
      />
      <PrivacyDiagnosticsSection />
      <RevioDebugToolsRow />
    </RevioSettingsPage>
  )
}
