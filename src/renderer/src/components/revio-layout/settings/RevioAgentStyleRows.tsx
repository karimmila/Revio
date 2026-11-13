import type React from 'react'
import { translate } from '@/i18n/i18n'
import type { ClaudeOutputStyle, CodexPersonality } from '../../../../../shared/revio-agent-style'
import { RevioSelect, RevioSettingRow } from './RevioSettingsRows'
import { useRevioSettings } from './use-revio-settings'

/** The Models rows "Codex personality" and "Claude output style"; new chats only. */
export function RevioAgentStyleRows(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const personality = translate(
    'auto.components.revioLayout.settings.codexPersonality',
    'Codex personality for new chats'
  )
  const outputStyle = translate(
    'auto.components.revioLayout.settings.claudeOutputStyle',
    'Claude output style'
  )
  return (
    <>
      <RevioSettingRow
        label={personality}
        description={translate(
          'auto.components.revioLayout.settings.codexPersonalityDescription',
          'Style to use when a new chat starts with a Codex model'
        )}
        control={
          <RevioSelect<CodexPersonality>
            label={personality}
            value={settings.revioCodexPersonality ?? 'pragmatic'}
            options={[
              {
                value: 'pragmatic',
                label: translate(
                  'auto.components.revioLayout.settings.personalityPragmatic',
                  'Pragmatic (default)'
                )
              },
              {
                value: 'friendly',
                label: translate(
                  'auto.components.revioLayout.settings.personalityFriendly',
                  'Friendly'
                )
              },
              {
                value: 'none',
                label: translate('auto.components.revioLayout.settings.personalityNone', 'None')
              }
            ]}
            onChange={(value) => update({ revioCodexPersonality: value })}
          />
        }
      />
      <RevioSettingRow
        label={outputStyle}
        description={translate(
          'auto.components.revioLayout.settings.claudeOutputStyleDescription',
          'Choose which output style to apply to new chats. Existing chats do not change.'
        )}
        control={
          <RevioSelect<ClaudeOutputStyle>
            label={outputStyle}
            value={settings.revioClaudeOutputStyle ?? 'default'}
            options={[
              {
                value: 'default',
                label: translate('auto.components.revioLayout.settings.styleDefault', 'Default')
              },
              {
                value: 'explanatory',
                label: translate(
                  'auto.components.revioLayout.settings.styleExplanatory',
                  'Explanatory'
                )
              },
              {
                value: 'learning',
                label: translate('auto.components.revioLayout.settings.styleLearning', 'Learning')
              }
            ]}
            onChange={(value) => update({ revioClaudeOutputStyle: value })}
          />
        }
      />
    </>
  )
}
