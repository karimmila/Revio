import React from 'react'
import { Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { RevioSettingRow } from '@/components/revio-layout/settings/RevioSettingsRows'
import type { WorkspaceSetupLive } from './use-workspace-setup-statuses'
import { ipcErrorText, SetupCommand, SetupRows, SetupStatusBadge } from './WorkspaceSetupParts'
import {
  requiredToolInstallCommand,
  requiredToolInstallPage
} from '../../../../../shared/missing-tool-install'

type MacCheck = 'idle' | 'checking' | 'still-signed-out'

/** What "Check again" found: a spinner while it reads, then the answer in words. */
function MacCheckResult({ check }: { check: MacCheck }): React.JSX.Element | null {
  if (check === 'idle') {
    return null
  }
  return (
    <span
      role="status"
      data-claude-check={check}
      className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground"
    >
      {check === 'checking' ? (
        <>
          <Loader2 className="size-3 animate-spin" aria-hidden />
          {translate('components.onboarding.workspace.agent.checking', 'Checking…')}
        </>
      ) : (
        translate('components.onboarding.workspace.agent.stillSignedOut', 'Still not signed in')
      )}
    </span>
  )
}

/** The install command to copy, with a link to Claude Code's own install steps. */
function MacInstallHint(): React.JSX.Element {
  const installCommand = requiredToolInstallCommand(
    'claude',
    window.api?.platform?.get?.().platform ?? ''
  )
  return (
    <span data-claude-missing="" className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {installCommand ? <SetupCommand>{installCommand}</SetupCommand> : null}
      <button
        type="button"
        data-revio-settings-text-button=""
        onClick={() => void window.api.shell.openUrl(requiredToolInstallPage('claude'))}
      >
        {translate('components.onboarding.workspace.agent.cliInstallGuide', 'Install guide')}
      </button>
    </span>
  )
}

function macLoginDescription(live: WorkspaceSetupLive, notInstalled: boolean): string {
  if (notInstalled) {
    return translate(
      'components.onboarding.workspace.agent.macNotInstalled',
      'Claude Code is not installed on this Mac. Run this in a terminal, then run claude once to sign in and press Check again:'
    )
  }
  if (live.claudeRoute === 'managed') {
    return translate(
      'components.onboarding.workspace.agent.macManaged',
      'A Claude account is signed in here. Workspaces on this Mac use it.'
    )
  }
  if (live.claudeRoute === 'apiKey') {
    return translate(
      'components.onboarding.workspace.agent.macApiKey',
      'Claude uses your API key or provider here. Workspaces on this Mac use it.'
    )
  }
  if (live.claudeMac === 'connected') {
    return translate(
      'components.onboarding.workspace.agent.macSignedIn',
      'Claude Code is signed in here. Workspaces on this Mac use this login.'
    )
  }
  return translate(
    'components.onboarding.workspace.agent.macSignedOut',
    'Run this in a terminal and sign in, then press Check again:'
  )
}

function macLoginBadgeLabel(live: WorkspaceSetupLive, notInstalled: boolean): string | undefined {
  if (notInstalled) {
    return translate('components.onboarding.workspace.agent.notInstalled', 'Not installed')
  }
  if (live.claudeMac === 'connected') {
    return translate('components.onboarding.workspace.agent.signedIn', 'Signed in')
  }
  if (live.claudeMac === 'not-connected') {
    return translate('components.onboarding.workspace.agent.notSignedIn', 'Not signed in')
  }
  return undefined
}

function MacLoginRow({
  live,
  claudeInstalled,
  onCheckTools
}: {
  live: WorkspaceSetupLive
  /** False when no `claude` command was found on this Mac; null while unknown. */
  claudeInstalled: boolean | null
  onCheckTools: () => void
}): React.JSX.Element {
  const signedIn = live.claudeMac === 'connected'
  // An API key alone reads as signed in, but a workspace still needs the claude command to run.
  const notInstalled = claudeInstalled === false
  const [check, setCheck] = React.useState<MacCheck>('idle')
  const checkAgain = (): void => {
    setCheck('checking')
    onCheckTools()
    const route = window.api.claudeAccounts?.loginRoute() ?? Promise.resolve('none' as const)
    void route
      .catch(() => 'none' as const)
      .then((next) => {
        // Signed in: the row's own "Signed in" badge is the answer.
        setCheck(next === 'none' ? 'still-signed-out' : 'idle')
        live.refresh({ claudeUsage: true })
      })
  }
  const settled = signedIn && !notInstalled
  return (
    <RevioSettingRow
      label={translate('components.onboarding.workspace.agent.mac', 'Claude on this Mac')}
      description={macLoginDescription(live, notInstalled)}
      hint={
        notInstalled ? (
          <MacInstallHint />
        ) : signedIn ? undefined : (
          <SetupCommand>claude</SetupCommand>
        )
      }
      control={
        <>
          {settled || notInstalled ? null : <MacCheckResult check={check} />}
          <SetupStatusBadge
            status={notInstalled ? 'not-connected' : live.claudeMac}
            label={macLoginBadgeLabel(live, notInstalled)}
          />
          {settled ? null : (
            <button
              type="button"
              data-revio-settings-button=""
              disabled={check === 'checking'}
              onClick={checkAgain}
            >
              {translate('components.onboarding.workspace.checkAgain', 'Check again')}
            </button>
          )}
        </>
      }
    />
  )
}

/** The token `claude setup-token` prints, sealed on this Mac by the same call Settings uses. */
function CloudTokenRow({ live }: { live: WorkspaceSetupLive }): React.JSX.Element {
  const [draft, setDraft] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const saved = live.claudeCloudTokenSet === true
  const save = (): void => {
    const api = window.api.cloud
    if (!api || !draft.trim() || busy) {
      return
    }
    setBusy(true)
    void api
      .setClaudeToken(draft)
      .then(() => {
        setDraft('')
        setError(null)
        live.refresh()
      })
      .catch((reason: unknown) => setError(ipcErrorText(reason)))
      .finally(() => setBusy(false))
  }
  return (
    <RevioSettingRow
      label={translate('components.onboarding.workspace.agent.cloud', 'Claude in cloud workspaces')}
      description={
        saved
          ? translate(
              'components.onboarding.workspace.agent.cloudSaved',
              'A setup token is saved. It stays sealed on this Mac; sandboxes only get a stand-in.'
            )
          : translate(
              'components.onboarding.workspace.agent.cloudMissing',
              'Run this on this Mac and paste the token it prints. It stays sealed on this Mac; sandboxes only get a stand-in.'
            )
      }
      hint={
        error ? (
          <span className="text-destructive">{error}</span>
        ) : saved ? undefined : (
          <SetupCommand>claude setup-token</SetupCommand>
        )
      }
      control={
        <>
          <SetupStatusBadge
            status={
              live.claudeCloudTokenSet === null ? 'checking' : saved ? 'connected' : 'not-connected'
            }
            label={
              saved
                ? translate('components.onboarding.workspace.agent.tokenSaved', 'Token saved')
                : live.claudeCloudTokenSet === false
                  ? translate('components.onboarding.workspace.agent.noToken', 'No token')
                  : undefined
            }
          />
          {saved ? (
            <button
              type="button"
              data-revio-settings-button=""
              onClick={() =>
                void window.api.cloud
                  ?.clearClaudeToken()
                  .then(() => live.refresh())
                  .catch((reason: unknown) => setError(ipcErrorText(reason)))
              }
            >
              {translate('components.onboarding.workspace.agent.removeToken', 'Remove')}
            </button>
          ) : null}
        </>
      }
      below={
        saved ? undefined : (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              placeholder="sk-ant-oat01-…"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
                  event.preventDefault()
                  save()
                }
              }}
              aria-label={translate(
                'components.onboarding.workspace.agent.tokenField',
                'Claude setup token'
              )}
              className="h-8 w-full max-w-80"
            />
            <button
              type="button"
              data-revio-settings-button=""
              disabled={busy || !draft.trim()}
              onClick={save}
            >
              {translate('components.onboarding.workspace.save', 'Save')}
            </button>
          </div>
        )
      }
    />
  )
}

export function WorkspaceSetupAgentStep({
  live,
  claudeInstalled,
  onCheckTools
}: {
  live: WorkspaceSetupLive
  claudeInstalled: boolean | null
  onCheckTools: () => void
}): React.JSX.Element {
  return (
    <SetupRows>
      <MacLoginRow live={live} claudeInstalled={claudeInstalled} onCheckTools={onCheckTools} />
      <CloudTokenRow live={live} />
    </SetupRows>
  )
}
