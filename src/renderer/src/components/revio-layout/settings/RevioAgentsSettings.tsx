import React from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { addAndSelectClaudeAccount } from '@/lib/claude-account-add'
import { extractIpcErrorMessage } from '@/lib/ipc-error'
import type { CursorAccountStatus } from '../../../../../shared/rate-limit-types'
import {
  RevioSelect,
  RevioSettingRow,
  RevioSettingsGroup,
  RevioSettingsPage
} from './RevioSettingsRows'
import { RevioAcpAgentRows } from './RevioAcpAgentRows'
import { RevioAgentStatusHooksRow } from './RevioAgentStatusHooksRow'
import { useRevioSettings } from './use-revio-settings'
import { RevioClaudeProviderRows } from './RevioClaudeProviderRows'
import { RevioSecretField, useAgentCredentialStatus } from './RevioSecretField'

// Key prefixes, not prose: the same in every language.
const OPENAI_KEY_PLACEHOLDER = 'sk-…'

function activeEmail(
  accounts: readonly { id: string; email: string }[],
  activeId: string | null
): string | null {
  return accounts.find((account) => account.id === activeId)?.email ?? accounts[0]?.email ?? null
}

function AccountStatus({ email }: { email: string | null }): React.JSX.Element | null {
  return email ? <span data-revio-settings-status="">{email}</span> : null
}

function ClaudeControl(): React.JSX.Element {
  const { settings } = useRevioSettings()
  const [busy, setBusy] = React.useState(false)
  const email = activeEmail(settings.claudeManagedAccounts, settings.activeClaudeManagedAccountId)
  return (
    <>
      <AccountStatus email={email} />
      <button
        type="button"
        data-revio-settings-button=""
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void addAndSelectClaudeAccount().finally(() => setBusy(false))
        }}
      >
        {email
          ? translate('auto.components.revioLayout.settings.addAccount', 'Add account')
          : translate('auto.components.revioLayout.settings.signIn', 'Sign in')}
      </button>
    </>
  )
}

function CodexControl(): React.JSX.Element {
  const { settings } = useRevioSettings()
  const fetchSettings = useAppStore((s) => s.fetchSettings)
  const [busy, setBusy] = React.useState(false)
  const email = activeEmail(settings.codexManagedAccounts, settings.activeCodexManagedAccountId)
  const add = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.codexAccounts.add()
      await fetchSettings()
    } catch (error) {
      toast.error(
        translate('auto.components.revioLayout.settings.codexFailed', 'Codex sign-in failed.'),
        { description: extractIpcErrorMessage(error, '') || undefined }
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <AccountStatus email={email} />
      <button
        type="button"
        data-revio-settings-button=""
        disabled={busy}
        onClick={() => void add()}
      >
        {email
          ? translate('auto.components.revioLayout.settings.addAccount', 'Add account')
          : translate('auto.components.revioLayout.settings.setUp', 'Set up')}
      </button>
    </>
  )
}

/** Cursor keeps its own login; Sign in runs `cursor-agent login`, which finishes in the browser. */
function CursorControl(): React.JSX.Element {
  const [status, setStatus] = React.useState<CursorAccountStatus | null>(null)
  const [signingIn, setSigningIn] = React.useState(false)
  const refresh = React.useCallback(() => {
    void window.api.cursorAccounts
      .getStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])
  React.useEffect(refresh, [refresh])
  return (
    <>
      <span data-revio-settings-status="">
        {status?.signedIn
          ? (status.email ??
            translate('auto.components.revioLayout.settings.connected', 'Connected'))
          : translate(
              'auto.components.revioLayout.settings.cursorSignIn',
              'Run cursor-agent login in a terminal'
            )}
      </span>
      {!status?.signedIn && window.api.agentCredentials ? (
        <button
          type="button"
          data-revio-settings-button=""
          disabled={signingIn}
          onClick={() => {
            setSigningIn(true)
            void window.api.agentCredentials
              ?.cursorLogin()
              .catch((error: unknown) =>
                toast.error(
                  translate(
                    'auto.components.revioLayout.settings.cursorFailed',
                    'Cursor sign-in failed.'
                  ),
                  { description: extractIpcErrorMessage(error, '') || undefined }
                )
              )
              .finally(() => {
                setSigningIn(false)
                refresh()
              })
          }}
        >
          {translate('auto.components.revioLayout.settings.signIn', 'Sign in')}
        </button>
      ) : null}
      <button type="button" data-revio-settings-button="" onClick={refresh}>
        {translate('auto.components.revioLayout.settings.refresh', 'Refresh')}
      </button>
    </>
  )
}

function CodexAuthRows({
  credentials,
  onCredentials
}: {
  credentials: ReturnType<typeof useAgentCredentialStatus>[0]
  onCredentials: ReturnType<typeof useAgentCredentialStatus>[1]
}): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const apiKey = settings.revioCodexAuth === 'apiKey'
  const label = translate('auto.components.revioLayout.settings.codexAuth', 'Codex sign-in')
  return (
    <>
      <RevioSettingRow
        label={label}
        control={
          <RevioSelect<'account' | 'apiKey'>
            label={label}
            value={apiKey ? 'apiKey' : 'account'}
            options={[
              {
                value: 'account',
                label: translate(
                  'auto.components.revioLayout.settings.codexAuthAccount',
                  'ChatGPT account'
                )
              },
              {
                value: 'apiKey',
                label: translate(
                  'auto.components.revioLayout.settings.claudeProviderApiKey',
                  'API key'
                )
              }
            ]}
            onChange={(next) =>
              update({ revioCodexAuth: next === 'apiKey' ? 'apiKey' : undefined })
            }
          />
        }
      />
      {apiKey ? (
        <RevioSettingRow
          label={translate('auto.components.revioLayout.settings.openaiApiKey', 'OpenAI API key')}
          control={
            <RevioSecretField
              name="openaiApiKey"
              label={translate(
                'auto.components.revioLayout.settings.openaiApiKey',
                'OpenAI API key'
              )}
              placeholder={OPENAI_KEY_PLACEHOLDER}
              status={credentials}
              onStatus={onCredentials}
            />
          }
        />
      ) : null}
    </>
  )
}

export function RevioAgentsSettings(): React.JSX.Element {
  const [credentials, setCredentials] = useAgentCredentialStatus()
  return (
    <RevioSettingsPage
      title={translate('auto.components.revioLayout.settings.agents', 'Agents')}
      description={translate(
        'auto.components.revioLayout.settings.agentsDescription',
        'Connect the subscriptions your agents run on.'
      )}
    >
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.claudeCode', 'Claude Code')}
        control={<ClaudeControl />}
      />
      <RevioClaudeProviderRows credentials={credentials} onCredentials={setCredentials} />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.codex', 'Codex')}
        control={<CodexControl />}
      />
      <CodexAuthRows credentials={credentials} onCredentials={setCredentials} />
      <RevioSettingRow
        label={translate('auto.components.revioLayout.settings.cursor', 'Cursor')}
        control={<CursorControl />}
      />
      <RevioSettingsGroup
        title={translate('auto.components.revioLayout.settings.acpAgents', 'ACP agents')}
      />
      <RevioAcpAgentRows />
      <RevioSettingsGroup
        title={translate('auto.components.revioLayout.settings.terminalAgents', 'Terminal')}
      />
      <RevioAgentStatusHooksRow />
    </RevioSettingsPage>
  )
}
