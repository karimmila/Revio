import React from 'react'
import { sidebarTransparencyUpdate } from '../../../../../shared/revio-sidebar-transparency'
import { isForkServiceEnabled } from '../../../../../shared/fork-services'
import { RevioInAppPreviewRow } from './RevioInAppPreviewRow'
import { RevioAutoRunAfterSetupRow } from './RevioAutoRunAfterSetupRow'
import { RevioBigTerminalRows } from './RevioBigTerminalRows'
import { RevioNewWorkspacePageRow } from './RevioNewWorkspacePageRow'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { handleVoiceDictationToggle } from '@/components/settings/voice/voice-dictation-toggle'
import { permissionUpdates } from '../../../../../shared/agent-launch/choices/agent-launch-permission-updates'
import { getDefaultVoiceSettings } from '../../../../../shared/constants'
import type { AgentPermissionChoice } from '../../../../../shared/agent-launch/permissions/tui-agent-permission-choice'
import { RevioSelect, RevioSettingRow, RevioSettingsPage, RevioSwitch } from './RevioSettingsRows'
import { openRevioSettingsPage } from './revio-settings-view'
import { useRevioSettings } from './use-revio-settings'
import { RevioTabRows } from './RevioTabRows'

type PermissionChoice = Exclude<AgentPermissionChoice, 'own'>

function PermissionControl(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const current = settings.agentPermissionDefault
  const options: { value: PermissionChoice; label: string }[] = [
    { value: 'ask', label: translate('auto.components.revioLayout.settings.permAsk', 'Ask') },
    {
      value: 'accept-edits',
      label: translate('auto.components.revioLayout.settings.permEdits', 'Accept edits')
    },
    {
      value: 'auto',
      label: translate('auto.components.revioLayout.settings.permAuto', 'Auto')
    },
    {
      value: 'full-access',
      label: translate('auto.components.revioLayout.settings.permFull', 'Full access')
    }
  ]
  const value = options.find((option) => option.value === current)?.value ?? 'full-access'
  return (
    <RevioSelect
      label={translate('auto.components.revioLayout.settings.permission', 'Permission mode')}
      value={value}
      options={options}
      onChange={(choice) => update(permissionUpdates(settings, { type: 'permission', choice }))}
    />
  )
}

function VoiceControl(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const markFeatureTipsSeen = useAppStore((s) => s.markFeatureTipsSeen)
  const [pending, setPending] = React.useState(false)
  const enabled = settings.voice?.enabled === true
  return (
    <RevioSwitch
      label={translate('auto.components.revioLayout.settings.voice', 'Voice mode')}
      checked={enabled}
      disabled={pending}
      onChange={() =>
        void handleVoiceDictationToggle({
          voiceEnabled: enabled,
          markFeatureTipsSeen,
          updateVoiceSettings: (updates) =>
            update({ voice: { ...(settings.voice ?? getDefaultVoiceSettings()), ...updates } }),
          requestMicrophonePermission: () =>
            window.api.developerPermissions.request({ id: 'microphone' }),
          setPermissionPending: setPending
        })
      }
    />
  )
}

export function RevioExperimentalSettings(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  return (
    <RevioSettingsPage
      title={translate('auto.components.revioLayout.settings.experimental', 'Experimental')}
      description={translate(
        'auto.components.revioLayout.settings.experimentalDescription',
        'Features that are still changing.'
      )}
    >
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.permission', 'Permission mode')}
        description={translate(
          'auto.components.revioLayout.settings.permissionDescription',
          'What new agents may do without asking. Auto lets Claude decide when to ask.'
        )}
        control={<PermissionControl />}
      />
      <RevioTabRows />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.dashboard', 'Dashboard')}
        description={translate(
          'auto.components.revioLayout.settings.dashboardDescription',
          'Show the agent dashboard: every running agent on one board.'
        )}
        control={
          <RevioSwitch
            label={translate('auto.components.revioLayout.settings.dashboard', 'Dashboard')}
            checked={settings.experimentalAgentDashboardPopout === true}
            onChange={(checked) => update({ experimentalAgentDashboardPopout: checked })}
          />
        }
      />
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.statusMatrix',
          'Workspace status matrix'
        )}
        description={translate(
          'auto.components.revioLayout.settings.statusMatrixDescription',
          'Show a matrix-style status indicator for local workspaces in Home and the sidebar.'
        )}
        control={
          <RevioSwitch
            label={translate(
              'auto.components.revioLayout.settings.statusMatrix',
              'Workspace status matrix'
            )}
            checked={settings.revioStatusMatrix === true}
            onChange={(checked) => update({ revioStatusMatrix: checked })}
          />
        }
      />
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.graphiteStacks',
          'Graphite stack support'
        )}
        description={translate(
          'auto.components.revioLayout.settings.graphiteStacksDescription',
          'Detect Graphite stacks for the active local workspace and show stack-aware UI in the git panel. When off, {{productName}} never runs the gt CLI.'
        )}
        control={
          <RevioSwitch
            label={translate(
              'auto.components.revioLayout.settings.graphiteStacks',
              'Graphite stack support'
            )}
            checked={settings.revioGraphiteStacks !== false}
            onChange={(checked) => update({ revioGraphiteStacks: checked })}
          />
        }
      />
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.sidebarTransparency',
          'Sidebar transparency'
        )}
        description={translate(
          'auto.components.revioLayout.settings.sidebarTransparencyDescription',
          'Use native macOS vibrancy behind the workspace sidebar. Takes effect after you restart {{productName}}.'
        )}
        control={
          <RevioSwitch
            label={translate(
              'auto.components.revioLayout.settings.sidebarTransparency',
              'Sidebar transparency'
            )}
            checked={settings.revioSidebarTransparency === true}
            onChange={(checked) => update(sidebarTransparencyUpdate(checked, settings))}
          />
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.workspaceTabs', 'Workspace tabs')}
        description={translate(
          'auto.components.revioLayout.settings.workspaceTabsDescription',
          'Show visited workspaces as tabs above the workspace, after a Home tab.'
        )}
        control={
          <RevioSwitch
            label={translate(
              'auto.components.revioLayout.settings.workspaceTabs',
              'Workspace tabs'
            )}
            checked={settings.revioWorkspaceTabs === true}
            onChange={(checked) => update({ revioWorkspaceTabs: checked })}
          />
        }
      />
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.sidebarResourceUsage',
          'Show sidebar resource usage'
        )}
        description={translate(
          'auto.components.revioLayout.settings.sidebarResourceUsageDescription',
          'Shows CPU and memory usage in the workspace sidebar footer.'
        )}
        control={
          <RevioSwitch
            label={translate(
              'auto.components.revioLayout.settings.sidebarResourceUsage',
              'Show sidebar resource usage'
            )}
            checked={settings.revioSidebarResourceUsage === true}
            onChange={(checked) => update({ revioSidebarResourceUsage: checked })}
          />
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.voice', 'Voice mode')}
        description={translate(
          'auto.components.revioLayout.settings.voiceDescription',
          'Enables speech-to-text in the chat composer.'
        )}
        control={<VoiceControl />}
      />
      {isForkServiceEnabled('relayBaseUrl') ? (
        <RevioSettingRow
          label={translate('auto.components.revioLayout.settings.remote', 'Remote control')}
          description={translate(
            'auto.components.revioLayout.settings.remoteDescription',
            'Control this Mac from the {{productName}} mobile app. Pair a phone to start.'
          )}
          control={
            <button
              type="button"
              data-revio-settings-button=""
              onClick={() => openRevioSettingsPage('remote')}
            >
              {translate('auto.components.revioLayout.settings.pairPhone', 'Pair phone')}
            </button>
          }
        />
      ) : null}
      <RevioAutoRunAfterSetupRow />
      <RevioInAppPreviewRow />
      <RevioBigTerminalRows />
      <RevioNewWorkspacePageRow />
    </RevioSettingsPage>
  )
}
