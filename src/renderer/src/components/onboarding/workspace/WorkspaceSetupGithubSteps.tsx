import type React from 'react'
import { Check } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { GithubNotice } from '@/components/revio-layout/settings/RevioCloudGithub'
import { RevioCloudGithubRepos } from '@/components/revio-layout/settings/RevioCloudGithubRepos'
import {
  GithubAccountLine,
  GithubAccountMenu,
  GithubChecking,
  GithubDeviceCode,
  GithubErrorLine,
  GithubExpiredLine,
  GithubSignInButton,
  GithubWaitingControl
} from '@/components/revio-layout/settings/RevioCloudGithubParts'
import { useCloudGithub } from '@/components/revio-layout/settings/use-cloud-github'
import { SetupRows } from './WorkspaceSetupParts'

type StepState = 'done' | 'current' | 'upcoming'

function GithubStep({
  number,
  state,
  title,
  action,
  children
}: {
  number: number
  state: StepState
  title: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <li data-github-step-state={state}>
      <div className="flex min-h-12 items-center gap-3 px-3 py-2">
        <span
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums',
            state === 'done' &&
              'border-transparent bg-status-success-background text-status-success',
            state === 'current' && 'border-foreground/30 font-medium text-foreground',
            state === 'upcoming' && 'text-muted-foreground'
          )}
        >
          {state === 'done' ? (
            <Check
              className="size-3"
              strokeWidth={3}
              aria-label={translate('components.onboarding.workspace.github.stepDone', 'Done')}
            />
          ) : (
            number
          )}
        </span>
        <div
          className={cn(
            'min-w-0 flex-1 text-[13px]',
            state === 'current' ? 'font-medium text-foreground' : 'text-muted-foreground'
          )}
        >
          {title}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children ? (
        <div className="flex flex-col gap-3 px-3 pb-3 pl-11 text-[12px] text-muted-foreground">
          {children}
        </div>
      ) : null}
    </li>
  )
}

/**
 * The onboarding GitHub connection as the numbered setup list: sign in, then install the
 * app on the owners of this Mac's repositories. Same calls and states as the Settings row.
 */
export function WorkspaceSetupGithubSteps(): React.JSX.Element {
  const controls = useCloudGithub()
  const { status, error, act } = controls
  const cloud = window.api.cloud
  if (!status || !status.app.configured) {
    return (
      <p className="text-[13px] text-muted-foreground">
        {status && !status.app.configured ? (
          status.app.message
        ) : error ? (
          <GithubErrorLine message={error} />
        ) : (
          <GithubChecking />
        )}
      </p>
    )
  }
  const { account, app } = status
  const signInTitle = translate(
    'components.onboarding.workspace.github.stepSignIn',
    'Sign in to GitHub'
  )
  const notice = <GithubNotice {...controls} status={status} />
  return (
    <SetupRows>
      <ol
        data-github-setup-steps=""
        className="divide-y divide-border rounded-lg border border-border"
      >
        {account ? (
          <GithubStep
            number={1}
            state="done"
            title={
              <GithubAccountLine
                host={app.host}
                login={account.login}
                dot={false}
                lead={translate(
                  'components.onboarding.workspace.github.stepSignedInAs',
                  'Signed in to GitHub as'
                )}
              />
            }
            action={
              <GithubAccountMenu
                onRevoke={() => void window.api.shell.openUrl(app.authorizationsUrl)}
                onSignOut={() => act(cloud?.githubSignOut)}
              />
            }
          >
            {error || status.migrated ? notice : null}
          </GithubStep>
        ) : status.signIn ? (
          <GithubStep
            number={1}
            state="current"
            title={signInTitle}
            action={<GithubWaitingControl onCancel={() => act(cloud?.githubCancelSignIn)} />}
          >
            <GithubDeviceCode
              code={status.signIn.userCode}
              onOpen={() => act(cloud?.githubOpenVerification)}
            />
            {error ? notice : null}
          </GithubStep>
        ) : (
          <GithubStep
            number={1}
            state="current"
            title={signInTitle}
            action={
              <GithubSignInButton
                expired={status.signInExpired}
                onClick={() => act(cloud?.githubSignIn)}
              />
            }
          >
            {status.signInExpired ? <GithubExpiredLine /> : null}
            {error || status.migrated ? notice : null}
          </GithubStep>
        )}
        <GithubStep
          number={2}
          state={account ? 'current' : 'upcoming'}
          title={translate(
            'components.onboarding.workspace.github.stepInstall',
            'Install the app on your repositories'
          )}
        >
          {account ? (
            <RevioCloudGithubRepos
              status={status}
              onInstall={(owner) => act(() => cloud?.githubInstall(owner) ?? Promise.resolve())}
              onRecheck={() => act(cloud?.githubRecheck)}
            />
          ) : null}
        </GithubStep>
      </ol>
    </SetupRows>
  )
}
