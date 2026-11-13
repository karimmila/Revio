import type React from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { nativeChatQueueFollowUps } from '../../../../../shared/native-chat/input/native-chat-follow-up-behavior'
import {
  computerAwakeSettingsForMode,
  normalizeComputerAwakeMode
} from '../../../../../shared/computer-awake-mode'
import {
  RevioKeys,
  RevioSelect,
  RevioSettingRow,
  RevioSettingsPage,
  RevioSwitch
} from './RevioSettingsRows'
import { CompletionSoundControl, FullDiskAccessControl } from './RevioGeneralControls'
import { useRevioSettings } from './use-revio-settings'
import { isAppUpdaterEnabled } from '../../../../../shared/update-feed'

function SwitchRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <RevioSettingRow
      label={label}
      description={description}
      control={<RevioSwitch label={label} checked={checked} onChange={onChange} />}
    />
  )
}

export function RevioGeneralSettings(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const sortBy = useAppStore((s) => s.sortBy)
  const setSortBy = useAppStore((s) => s.setSortBy)
  const modEnter = settings.revioSendWithModEnter === true
  const queue = nativeChatQueueFollowUps(settings)
  const notifications = settings.notifications
  const awake = normalizeComputerAwakeMode(
    settings.computerAwakeMode,
    settings.keepComputerAwakeWhileAgentsRun
  )
  return (
    <RevioSettingsPage title={translate('auto.components.revioLayout.settings.general', 'General')}>
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.sendWith', 'Send messages with')}
        description={translate(
          'auto.components.revioLayout.settings.sendWithDescription',
          'Choose which key combination sends messages'
        )}
        hint={
          <>
            {translate('auto.components.revioLayout.settings.use', 'Use')}{' '}
            <RevioKeys keys={modEnter ? '↵' : '⇧↵'} />{' '}
            {translate('auto.components.revioLayout.settings.forNewLines', 'for new lines')}
          </>
        }
        control={
          <RevioSelect
            label={translate('auto.components.revioLayout.settings.sendWith', 'Send messages with')}
            value={modEnter ? 'mod-enter' : 'enter'}
            options={[
              {
                value: 'enter',
                label: translate('auto.components.revioLayout.settings.enter', 'Enter')
              },
              {
                value: 'mod-enter',
                label: translate('auto.components.revioLayout.settings.modEnter', '⌘ Enter')
              }
            ]}
            onChange={(value) => update({ revioSendWithModEnter: value === 'mod-enter' })}
          />
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.followUp', 'Follow-up behavior')}
        description={translate(
          'auto.components.revioLayout.settings.followUpDescription',
          'Queue messages to send after the agent finishes, or steer the agent mid-turn.'
        )}
        hint={
          <>
            {translate('auto.components.revioLayout.settings.use', 'Use')}{' '}
            <RevioKeys keys={modEnter ? '⌘⇧↵' : '⌘↵'} />{' '}
            {queue
              ? translate('auto.components.revioLayout.settings.toSteer', 'to steer')
              : translate('auto.components.revioLayout.settings.toQueue', 'to queue')}
          </>
        }
        control={
          <RevioSelect
            label={translate('auto.components.revioLayout.settings.followUp', 'Follow-up behavior')}
            value={queue ? 'queue' : 'steer'}
            options={[
              {
                value: 'steer',
                label: translate('auto.components.revioLayout.settings.steer', 'Steer')
              },
              {
                value: 'queue',
                label: translate('auto.components.revioLayout.settings.queue', 'Queue')
              }
            ]}
            onChange={(value) => update({ nativeChatQueueFollowUps: value === 'queue' })}
          />
        }
      />
      <SwitchRow
        label={translate(
          'auto.components.revioLayout.settings.agentNotifications',
          'Agent notifications'
        )}
        description={translate(
          'auto.components.revioLayout.settings.agentNotificationsDescription',
          'Get notified when an agent finishes working.'
        )}
        checked={notifications.enabled && notifications.agentTaskComplete}
        onChange={(checked) =>
          update({
            notifications: {
              ...notifications,
              agentTaskComplete: checked,
              // Turning this on must also lift Orca's master switch, or nothing would arrive.
              enabled: checked ? true : notifications.enabled
            }
          })
        }
      />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.sound', 'Completion sound')}
        description={translate(
          'auto.components.revioLayout.settings.soundDescription',
          'Choose what plays when AI finishes working in a chat.'
        )}
        control={<CompletionSoundControl />}
      />
      <RevioSettingRow
        label={translate(
          'auto.components.revioLayout.settings.fullDisk',
          'Full disk access permissions'
        )}
        description={translate(
          'auto.components.revioLayout.settings.fullDiskDescription',
          'To let agents work without repeated folder permission prompts.'
        )}
        control={<FullDiskAccessControl />}
      />
      <SwitchRow
        label={translate(
          'auto.components.revioLayout.settings.arrangeManually',
          'Arrange workspaces manually'
        )}
        checked={sortBy === 'manual'}
        onChange={(checked) => setSortBy(checked ? 'manual' : 'recent')}
      />
      <SwitchRow
        label={translate(
          'auto.components.revioLayout.settings.autoConvert',
          'Auto-convert long text'
        )}
        description={translate(
          'auto.components.revioLayout.settings.autoConvertDescription',
          'Convert pasted text over 5000 characters into text attachments'
        )}
        checked={settings.revioPasteLongTextAsAttachment !== false}
        onChange={(checked) => update({ revioPasteLongTextAsAttachment: checked })}
      />
      <SwitchRow
        label={translate(
          'auto.components.revioLayout.settings.notAbsolutelyRight',
          "I'm not absolutely right, thank you very much"
        )}
        description={translate(
          'auto.components.revioLayout.settings.notAbsolutelyRightDescription',
          'Strip "You\'re absolutely right!" from AI messages'
        )}
        checked={settings.revioStripAbsolutelyRight === true}
        onChange={(checked) => update({ revioStripAbsolutelyRight: checked })}
      />
      <SwitchRow
        label={translate(
          'auto.components.revioLayout.settings.alwaysShowContextUsage',
          'Always show context usage'
        )}
        description={translate(
          'auto.components.revioLayout.settings.alwaysShowContextUsageDescription',
          'Always show context usage. By default, it is only shown when more than 70% is used.'
        )}
        checked={settings.revioAlwaysShowContextUsage === true}
        onChange={(checked) => update({ revioAlwaysShowContextUsage: checked })}
      />
      <SwitchRow
        label={translate(
          'auto.components.revioLayout.settings.caffeinate',
          'Caffeinate while agents are running'
        )}
        description={translate(
          'auto.components.revioLayout.settings.caffeinateDescription',
          'Prevent your Mac from sleeping while an agent is actively working.'
        )}
        checked={awake !== 'off'}
        onChange={(checked) => update(computerAwakeSettingsForMode(checked ? 'auto' : 'off'))}
      />
      {isAppUpdaterEnabled() ? (
        <SwitchRow
          label={translate(
            'auto.components.revioLayout.settings.restartOnUpdate',
            'Restart automatically on update'
          )}
          description={translate(
            'auto.components.revioLayout.settings.restartOnUpdateDescription',
            'Install a downloaded update once no agent is working and the Mac has been idle for 5 minutes.'
          )}
          checked={settings.revioRestartOnUpdate === true}
          onChange={(checked) => update({ revioRestartOnUpdate: checked })}
        />
      ) : null}
      <SwitchRow
        label={translate(
          'auto.components.revioLayout.settings.showArtifactsTab',
          'Show Artifacts tab'
        )}
        description={translate(
          'auto.components.revioLayout.settings.showArtifactsTabDescription',
          'Show the Artifacts tab in the right panel and the Artifacts shortcut in the sidebar.'
        )}
        checked={settings.showArtifactsButton === true}
        onChange={(checked) => update({ showArtifactsButton: checked })}
      />
      <SwitchRow
        label={translate(
          'auto.components.revioLayout.settings.defaultPlanMode',
          'Default to plan mode in new chats'
        )}
        description={translate(
          'auto.components.revioLayout.settings.defaultPlanModeDescription',
          'New Claude and Codex chats start in plan mode. ⇧Tab switches a chat back.'
        )}
        checked={settings.revioDefaultPlanMode === true}
        onChange={(checked) => update({ revioDefaultPlanMode: checked })}
      />
      <SwitchRow
        label={translate(
          'auto.components.revioLayout.settings.expandToolCalls',
          "Don't collapse tool calls"
        )}
        description={translate(
          'auto.components.revioLayout.settings.expandToolCallsDescription',
          'Show all tool calls expanded by default instead of collapsed.'
        )}
        checked={settings.revioExpandToolCalls === true}
        onChange={(checked) => update({ revioExpandToolCalls: checked })}
      />
    </RevioSettingsPage>
  )
}
