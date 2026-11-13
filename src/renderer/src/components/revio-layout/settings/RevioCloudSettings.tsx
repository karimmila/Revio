import React from 'react'
import { getIntlLocale, translate } from '@/i18n/i18n'
import type {
  VercelCloudStatus,
  VercelSignInStart
} from '../../../../../shared/vercel-cloud/vercel-cloud-types'
import { RevioSelect, RevioSettingRow, RevioSettingsPage } from './RevioSettingsRows'
import { RevioCloudInventory } from './RevioCloudInventory'
import { RevioGitHubAccount } from './RevioGitHubAccount'
import { useRevioSettings } from './use-revio-settings'
import { vercelNoTeamsText } from './vercel-cloud-copy'

type View =
  | { kind: 'loading' }
  | { kind: 'status'; status: VercelCloudStatus }
  | { kind: 'signing-in'; start: VercelSignInStart }

function errorMessage(error: unknown): string {
  // Electron prefixes a main-process error with the channel name; people need only the sentence.
  return (error instanceof Error ? error.message : String(error)).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    ''
  )
}

export function planLabel(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1)
}

export function useVercelCloud(): {
  view: View
  connect: () => void
  cancel: () => void
  disconnect: () => void
  selectTeam: (teamId: string) => void
  connectToken: (token: string) => Promise<string | null>
  /** Reads the connection again, after a network failure or a change made on vercel.com. */
  recheck: () => void
} {
  const [view, setView] = React.useState<View>({ kind: 'loading' })
  const api = window.api.vercelCloud
  const read = React.useCallback(() => {
    void api
      ?.status()
      .then((status) => setView({ kind: 'status', status }))
      .catch((error: unknown) =>
        setView({ kind: 'status', status: { state: 'error', message: errorMessage(error) } })
      )
  }, [api])
  React.useEffect(read, [read])
  const show = (status: VercelCloudStatus): void => setView({ kind: 'status', status })
  const fail = (error: unknown): void => show({ state: 'error', message: errorMessage(error) })
  return {
    view,
    recheck: () => {
      setView({ kind: 'loading' })
      read()
    },
    connect: () => {
      if (!api) {
        return
      }
      void api
        .startSignIn()
        .then((start) => {
          setView({ kind: 'signing-in', start })
          return api.waitForSignIn()
        })
        .then(show)
        .catch(fail)
    },
    cancel: () => {
      void api?.cancelSignIn()
      show({ state: 'disconnected' })
    },
    disconnect: () => {
      void api
        ?.disconnect()
        .then(() => show({ state: 'disconnected' }))
        .catch(fail)
    },
    selectTeam: (teamId) => {
      setView({ kind: 'loading' })
      void api?.selectTeam(teamId).then(show).catch(fail)
    },
    // Resolves with the refusal to show beside the field, or null once connected.
    connectToken: async (token) => {
      if (!api) {
        return null
      }
      try {
        show(await api.connectToken(token))
        return null
      } catch (error) {
        return errorMessage(error)
      }
    }
  }
}

export function SignInRow({
  start,
  onCancel
}: {
  start: VercelSignInStart
  onCancel: () => void
}): React.JSX.Element {
  return (
    <RevioSettingRow
      label={translate('auto.components.revioLayout.settings.vercel', 'Vercel')}
      description={translate(
        'auto.components.revioLayout.settings.vercelApprove',
        'Approve {{productName}} in the browser tab that just opened. The code there should match:'
      )}
      hint={<code data-revio-device-code="">{start.userCode}</code>}
      control={
        <>
          <span data-revio-settings-status="">
            {translate('auto.components.revioLayout.settings.vercelWaiting', 'Waiting…')}
          </span>
          <button
            type="button"
            data-revio-settings-text-button=""
            onClick={() => void window.api.shell.openUrl(start.verificationUri)}
          >
            {translate('auto.components.revioLayout.settings.vercelReopen', 'Open again')}
          </button>
          <button type="button" data-revio-settings-button="" onClick={onCancel}>
            {translate('auto.components.revioLayout.cancel', 'Cancel')}
          </button>
        </>
      }
    />
  )
}

/**
 * The alternative to the browser sign-in: an access token the person creates at vercel.com
 * (Account Settings > Tokens) with its scope set to their own team. Orca refuses a token that
 * reaches more than one team, so a company team the account also belongs to stays untouched.
 */
export function TeamTokenRow({
  onConnect
}: {
  onConnect: (token: string) => Promise<string | null>
}): React.JSX.Element {
  const [token, setToken] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [refusal, setRefusal] = React.useState<string | null>(null)
  return (
    <RevioSettingRow
      label={translate('auto.components.revioLayout.settings.vercelTeamToken', 'Use a team token')}
      description={
        refusal ??
        translate(
          'auto.components.revioLayout.settings.vercelTeamTokenDescription',
          'Recommended when your Vercel account is in more than one team. Create a token at vercel.com, Account Settings, Tokens, with Scope set to your team, and paste it here. {{productName}} refuses a token that reaches more than one team.'
        )
      }
      control={
        <>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder={translate(
              'auto.components.revioLayout.settings.vercelTokenPlaceholder',
              'Vercel token'
            )}
            aria-label={translate(
              'auto.components.revioLayout.settings.vercelTeamToken',
              'Use a team token'
            )}
            data-revio-settings-input=""
            className="h-7 w-44 rounded-md border border-border bg-transparent px-2 text-[12px] outline-none focus:border-ring"
          />
          <button
            type="button"
            data-revio-settings-button=""
            disabled={busy || !token.trim()}
            onClick={() => {
              setBusy(true)
              void onConnect(token).then((message) => {
                setBusy(false)
                setRefusal(message)
                if (!message) {
                  setToken('')
                }
              })
            }}
          >
            {translate('auto.components.revioLayout.settings.vercelUseToken', 'Use token')}
          </button>
        </>
      }
    />
  )
}

function expiryWarning(expiresAt: number | null | undefined, now: number): string | null {
  if (!expiresAt || expiresAt - now > 14 * 24 * 60 * 60 * 1000) {
    return null
  }
  return translate(
    'auto.components.revioLayout.settings.vercelTokenExpires',
    'This token expires {{value0}}. Create a new one and paste it here.',
    { value0: new Date(expiresAt).toLocaleDateString(getIntlLocale()) }
  )
}

const IDLE_CHOICES = ['0', '10', '20', '30', '60'] as const

/** How long a cloud workspace may sit unused before its sandbox stops (files kept). */
function IdleSleepRow(): React.JSX.Element {
  const { settings, update } = useRevioSettings()
  const minutes = String(settings.revioCloudIdleMinutes ?? 20)
  const value = IDLE_CHOICES.find((choice) => choice === minutes) ?? '20'
  return (
    <RevioSettingRow
      label={translate('auto.components.revioLayout.settings.idleSleep', 'Sleep when idle')}
      description={translate(
        'auto.components.revioLayout.settings.idleSleepDescription',
        'Stop a cloud workspace’s sandbox after this long without you, an agent, a running command or terminal output. Files stay; opening it resumes.'
      )}
      control={
        <RevioSelect
          label={translate('auto.components.revioLayout.settings.idleSleep', 'Sleep when idle')}
          value={value}
          options={IDLE_CHOICES.map((choice) => ({
            value: choice,
            label:
              choice === '0'
                ? translate('auto.components.revioLayout.settings.idleOff', 'Off')
                : translate('auto.components.revioLayout.settings.idleMinutes', '{{value0}} min', {
                    value0: choice
                  })
          }))}
          onChange={(next) => update({ revioCloudIdleMinutes: Number(next) })}
        />
      }
    />
  )
}

/**
 * Cloud workspaces run on the user's own Vercel account. Connecting is Vercel's browser sign-in;
 * the token stays sealed on this Mac and the page shows what the team's plan allows.
 */
export function RevioCloudSettings(): React.JSX.Element {
  const { view, connect, cancel, disconnect, selectTeam, connectToken, recheck } = useVercelCloud()
  const status = view.kind === 'status' ? view.status : null
  const [now] = React.useState(() => Date.now())
  const signedIn = status?.state === 'connected' || status?.state === 'choose-team'
  return (
    <RevioSettingsPage
      title={translate('auto.components.revioLayout.settings.cloud', 'Cloud')}
      description={translate(
        'auto.components.revioLayout.settings.cloudLede',
        'Cloud workspaces run in a Vercel Sandbox on your own Vercel account, one per workspace.'
      )}
    >
      {view.kind === 'signing-in' ? (
        <SignInRow start={view.start} onCancel={cancel} />
      ) : (
        <RevioSettingRow
          label={translate('auto.components.revioLayout.settings.vercel', 'Vercel')}
          description={
            status?.state === 'error'
              ? status.message
              : status?.state === 'connected' && status.via === 'token'
                ? (expiryWarning(status.tokenExpiresAt, now) ??
                  translate(
                    'auto.components.revioLayout.settings.vercelTokenConnected',
                    'Connected with a team token for {{value0}}. It is sealed on this Mac and never sent into a sandbox.',
                    { value0: status.team.name }
                  ))
                : translate(
                    'auto.components.revioLayout.settings.vercelDescription',
                    'Sign in with Vercel. {{productName}} keeps the token encrypted on this Mac and never sends it into a sandbox.'
                  )
          }
          control={
            view.kind === 'loading' ? (
              <span data-revio-settings-status="">
                {translate('auto.components.revioLayout.settings.checking', 'Checking…')}
              </span>
            ) : signedIn ? (
              <>
                <span data-revio-settings-status="">
                  {translate(
                    'auto.components.revioLayout.settings.connectedAs',
                    'Connected as {{value0}}',
                    { value0: status.username }
                  )}
                </span>
                <button type="button" data-revio-settings-button="" onClick={disconnect}>
                  {translate('auto.components.revioLayout.settings.disconnect', 'Disconnect')}
                </button>
              </>
            ) : (
              <>
                {status?.state === 'error' ? (
                  <button type="button" data-revio-settings-button="" onClick={recheck}>
                    {translate('components.onboarding.workspace.checkAgain', 'Check again')}
                  </button>
                ) : null}
                <button type="button" data-revio-settings-button="" onClick={connect}>
                  {translate(
                    'auto.components.revioLayout.settings.connectVercel',
                    'Connect Vercel'
                  )}
                </button>
              </>
            )
          }
        />
      )}
      {view.kind === 'status' && !signedIn ? <TeamTokenRow onConnect={connectToken} /> : null}
      {status?.state === 'choose-team' ? (
        <RevioSettingRow
          label={translate('auto.components.revioLayout.settings.vercelTeam', 'Team')}
          description={
            status.teams.length === 0
              ? vercelNoTeamsText()
              : translate(
                  'auto.components.revioLayout.settings.vercelChooseTeam',
                  'Pick the team sandboxes run and bill in. {{productName}} creates nothing on Vercel until you pick. If one of these teams is your company’s, a team token scoped to your own team is safer.'
                )
          }
          control={
            <RevioSelect
              label={translate('auto.components.revioLayout.settings.vercelTeam', 'Team')}
              value=""
              placeholder={translate(
                'auto.components.revioLayout.settings.vercelChooseTeamPlaceholder',
                'Choose a team'
              )}
              options={status.teams.map((team) => ({
                value: team.id,
                label: `${team.name} (${planLabel(team.plan)})`
              }))}
              onChange={selectTeam}
            />
          }
        />
      ) : null}
      {status?.state === 'connected' ? (
        <>
          <RevioSettingRow
            label={translate('auto.components.revioLayout.settings.vercelTeam', 'Team')}
            description={translate(
              'auto.components.revioLayout.settings.vercelTeamDescription',
              'Sandboxes run and bill in this team, inside its {{value0}} project.',
              {
                // Older connections keep a project with the upstream name; the label is the app's.
                value0: translate(
                  'auto.components.revioLayout.settings.sandboxProjectLabel',
                  '{{productName}} sandboxes'
                )
              }
            )}
            control={
              status.via === 'token' ? (
                <span data-revio-settings-status="">
                  {`${status.team.name} (${planLabel(status.team.plan)})`}
                </span>
              ) : (
                <RevioSelect
                  label={translate('auto.components.revioLayout.settings.vercelTeam', 'Team')}
                  value={status.team.id}
                  options={status.teams.map((team) => ({
                    value: team.id,
                    label: `${team.name} (${planLabel(team.plan)})`
                  }))}
                  onChange={selectTeam}
                />
              )
            }
          />
          <RevioSettingRow
            label={translate('auto.components.revioLayout.settings.vercelPlan', 'Plan limits')}
            description={translate(
              'auto.components.revioLayout.settings.vercelPlanDescription',
              '{{value0}}: up to {{value1}} vCPUs per sandbox and {{value2}} per session. {{productName}} stops a sandbox before the limit and resumes it when you return.',
              {
                value0: planLabel(status.limits.plan),
                value1: status.limits.maxVcpus,
                value2:
                  status.limits.maxSessionMinutes >= 60
                    ? `${status.limits.maxSessionMinutes / 60} h`
                    : `${status.limits.maxSessionMinutes} min`
              }
            )}
          />
          <RevioSettingRow
            label={translate('auto.components.revioLayout.settings.github', 'GitHub')}
            description={translate(
              'auto.components.revioLayout.settings.githubOnAccountPage',
              'Cloud workspaces push branches and open pull requests with your GitHub sign-in, in Settings > Account.'
            )}
            control={<RevioGitHubAccount />}
          />
          <IdleSleepRow />
          <RevioCloudInventory />
        </>
      ) : null}
    </RevioSettingsPage>
  )
}
