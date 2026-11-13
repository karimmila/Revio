import React from 'react'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import {
  claudeProviderFromSettings,
  claudeProviderUpdate,
  type ClaudeProvider
} from '../../../../../shared/claude-provider-env'
import type { AgentCredentialStatus } from '../../../../../shared/agent-credentials-types'
import { RevioSelect, RevioSettingRow, RevioSwitch } from './RevioSettingsRows'
import { RevioSecretField } from './RevioSecretField'
import { useRevioSettings } from './use-revio-settings'

// A sample URL and a key prefix, not prose: the same in every language.
const GATEWAY_URL_PLACEHOLDER = 'https://gateway.example.com'
const ANTHROPIC_KEY_PLACEHOLDER = 'sk-ant-…'

function providerOptions(): { value: ClaudeProvider; label: string }[] {
  return [
    {
      value: 'subscription',
      label: translate(
        'auto.components.revioLayout.settings.claudeProviderSubscription',
        'Claude account'
      )
    },
    {
      value: 'apiKey',
      label: translate('auto.components.revioLayout.settings.claudeProviderApiKey', 'API key')
    },
    {
      value: 'bedrock',
      label: translate(
        'auto.components.revioLayout.settings.claudeProviderBedrock',
        'Amazon Bedrock'
      )
    },
    {
      value: 'vertex',
      label: translate(
        'auto.components.revioLayout.settings.claudeProviderVertex',
        'Google Vertex AI'
      )
    },
    {
      value: 'custom',
      label: translate('auto.components.revioLayout.settings.claudeProviderCustom', 'Custom')
    }
  ]
}

function BaseUrlField(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const env = settings.agentDefaultEnv?.claude
  const saved = env?.ANTHROPIC_BASE_URL ?? ''
  const [draft, setDraft] = React.useState(saved)
  const commit = (): void => {
    const next = { ...env }
    if (draft.trim()) {
      next.ANTHROPIC_BASE_URL = draft.trim()
    } else {
      delete next.ANTHROPIC_BASE_URL
    }
    if (draft.trim() !== saved) {
      update({ agentDefaultEnv: { ...settings.agentDefaultEnv, claude: next } })
    }
  }
  return (
    <Input
      value={draft}
      placeholder={GATEWAY_URL_PLACEHOLDER}
      aria-label={translate('auto.components.revioLayout.settings.claudeBaseUrl', 'Base URL')}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit()
        }
      }}
      variant="code"
      className="h-8 w-56"
    />
  )
}

/** The Claude Code harness: where Claude Code signs in, and Claude in Chrome. */
export function RevioClaudeProviderRows({
  credentials,
  onCredentials
}: {
  credentials: AgentCredentialStatus | null
  onCredentials: (next: AgentCredentialStatus) => void
}): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const provider = claudeProviderFromSettings(settings)
  const label = translate(
    'auto.components.revioLayout.settings.claudeProvider',
    'Claude Code provider'
  )
  const chromeLabel = translate(
    'auto.components.revioLayout.settings.claudeChrome',
    'Use Claude Code with Chrome'
  )
  return (
    <>
      <RevioSettingRow
        label={label}
        description={translate(
          'auto.components.revioLayout.settings.claudeProviderDescription',
          'Bedrock and Vertex AI use your own AWS or Google Cloud credentials from this Mac. Keys stay on this Mac, encrypted when the system keychain is available.'
        )}
        control={
          <RevioSelect<ClaudeProvider>
            label={label}
            value={provider}
            options={providerOptions()}
            onChange={(next) => update(claudeProviderUpdate(settings, next))}
          />
        }
      />
      {provider === 'apiKey' ? (
        <RevioSettingRow
          label={translate(
            'auto.components.revioLayout.settings.anthropicApiKey',
            'Anthropic API key'
          )}
          control={
            <RevioSecretField
              name="anthropicApiKey"
              label={translate(
                'auto.components.revioLayout.settings.anthropicApiKey',
                'Anthropic API key'
              )}
              placeholder={ANTHROPIC_KEY_PLACEHOLDER}
              status={credentials}
              onStatus={onCredentials}
            />
          }
        />
      ) : null}
      {provider === 'custom' ? (
        <>
          <RevioSettingRow
            label={translate('auto.components.revioLayout.settings.claudeBaseUrl', 'Base URL')}
            description={translate(
              'auto.components.revioLayout.settings.claudeBaseUrlDescription',
              'An Anthropic-compatible gateway (ANTHROPIC_BASE_URL).'
            )}
            control={<BaseUrlField />}
          />
          <RevioSettingRow
            label={translate('auto.components.revioLayout.settings.claudeAuthToken', 'Auth token')}
            description={translate(
              'auto.components.revioLayout.settings.claudeAuthTokenDescription',
              'Sent as ANTHROPIC_AUTH_TOKEN.'
            )}
            control={
              <RevioSecretField
                name="anthropicAuthToken"
                label={translate(
                  'auto.components.revioLayout.settings.claudeAuthToken',
                  'Auth token'
                )}
                placeholder={translate(
                  'auto.components.revioLayout.settings.tokenFieldPlaceholder',
                  'token'
                )}
                status={credentials}
                onStatus={onCredentials}
              />
            }
          />
        </>
      ) : null}
      <RevioSettingRow
        label={chromeLabel}
        description={translate(
          'auto.components.revioLayout.settings.claudeChromeDescription',
          'New Claude chats can use the Claude in Chrome extension to drive your browser.'
        )}
        control={
          <RevioSwitch
            label={chromeLabel}
            checked={settings.revioClaudeChrome === true}
            onChange={(checked) => update({ revioClaudeChrome: checked })}
          />
        }
      />
    </>
  )
}
