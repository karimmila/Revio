import React from 'react'
import { translate } from '@/i18n/i18n'
import { RevioSelect, RevioSettingRow } from '@/components/revio-layout/settings/RevioSettingsRows'
import {
  planLabel,
  SignInRow,
  TeamTokenRow,
  useVercelCloud
} from '@/components/revio-layout/settings/RevioCloudSettings'
import { vercelNoTeamsText } from '@/components/revio-layout/settings/vercel-cloud-copy'
import type { WorkspaceSetupLive } from './use-workspace-setup-statuses'
import { vercelSetupStatus } from './workspace-setup-status'
import { SetupRows, SetupStatusBadge } from './WorkspaceSetupParts'

/** The Settings > Cloud connection, without its plan, idle and inventory rows. */
export function WorkspaceSetupCloudStep({ live }: { live: WorkspaceSetupLive }): React.JSX.Element {
  const { view, connect, cancel, disconnect, selectTeam, connectToken, recheck } = useVercelCloud()
  const status = view.kind === 'status' ? view.status : null
  const { setVercel } = live
  React.useEffect(() => {
    if (status) {
      setVercel(status)
    }
  }, [setVercel, status])
  const signedIn = status?.state === 'connected' || status?.state === 'choose-team'
  const teamLabel = translate('auto.components.revioLayout.settings.vercelTeam', 'Team')
  return (
    <SetupRows>
      {view.kind === 'signing-in' ? (
        <SignInRow start={view.start} onCancel={cancel} />
      ) : (
        <RevioSettingRow
          label={translate('auto.components.revioLayout.settings.vercel', 'Vercel')}
          description={
            status?.state === 'error'
              ? status.message
              : signedIn
                ? translate(
                    'components.onboarding.workspace.cloud.signedIn',
                    'Signed in as {{value0}}. The token is sealed on this Mac and never sent into a sandbox.',
                    { value0: status.username }
                  )
                : translate(
                    'components.onboarding.workspace.cloud.signedOut',
                    'Sign in with Vercel in the browser, or paste a token scoped to one Vercel team (account) below.'
                  )
          }
          control={
            <>
              <SetupStatusBadge
                status={view.kind === 'loading' ? 'checking' : vercelSetupStatus(status)}
              />
              {view.kind === 'loading' ? null : signedIn ? (
                <button type="button" data-revio-settings-button="" onClick={disconnect}>
                  {translate('auto.components.revioLayout.settings.disconnect', 'Disconnect')}
                </button>
              ) : (
                <>
                  {status?.state === 'error' ? (
                    <button type="button" data-revio-settings-button="" onClick={recheck}>
                      {translate('components.onboarding.workspace.checkAgain', 'Check again')}
                    </button>
                  ) : null}
                  <button type="button" data-revio-settings-button="" onClick={connect}>
                    {translate(
                      'components.onboarding.workspace.cloud.signIn',
                      'Sign in with Vercel'
                    )}
                  </button>
                </>
              )}
            </>
          }
        />
      )}
      {view.kind === 'status' && !signedIn ? <TeamTokenRow onConnect={connectToken} /> : null}
      {status?.state === 'choose-team' ||
      (status?.state === 'connected' && status.via !== 'token') ? (
        <RevioSettingRow
          label={teamLabel}
          description={
            status.teams.length === 0
              ? vercelNoTeamsText()
              : translate(
                  'components.onboarding.workspace.cloud.team',
                  'Pick the Vercel team (account) to use. Sandboxes run and bill there.'
                )
          }
          control={
            status.teams.length === 0 ? (
              <button type="button" data-revio-settings-button="" onClick={recheck}>
                {translate('components.onboarding.workspace.checkAgain', 'Check again')}
              </button>
            ) : (
              <RevioSelect
                label={teamLabel}
                value={status.state === 'connected' ? status.team.id : ''}
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
            )
          }
        />
      ) : null}
      {status?.state === 'connected' && status.via === 'token' ? (
        <RevioSettingRow
          label={teamLabel}
          description={translate(
            'components.onboarding.workspace.cloud.tokenTeam',
            'The token is scoped to this Vercel team (account). Sandboxes run and bill there.'
          )}
          control={
            <span data-revio-settings-status="">
              {`${status.team.name} (${planLabel(status.team.plan)})`}
            </span>
          }
        />
      ) : null}
    </SetupRows>
  )
}
