import type React from 'react'
import { translate } from '@/i18n/i18n'
import { FORK_PRODUCT_NAME } from '../../../../../shared/fork-identity'
import type { CloudGithubStatus } from '../../../../../shared/cloud/cloud-types'
import { RevioSettingRow } from './RevioSettingsRows'
import { RevioCloudGithubRepos } from './RevioCloudGithubRepos'
import {
  GithubAccountLine,
  GithubAccountMenu,
  GithubChecking,
  GithubDeviceCode,
  GithubErrorLine,
  GithubExpiredLine,
  GithubSignInButton,
  GithubWaitingControl
} from './RevioCloudGithubParts'
import { useCloudGithub, type CloudGithubControls } from './use-cloud-github'

/** The last action's error, else the one-time notice that old fine-grained tokens were deleted. */
export function GithubNotice({
  status,
  error,
  act
}: CloudGithubControls & { status: CloudGithubStatus }): React.JSX.Element | null {
  if (error) {
    return <GithubErrorLine message={error} />
  }
  if (!status.migrated) {
    return null
  }
  return (
    <span className="flex flex-wrap items-center gap-x-1">
      {translate(
        'auto.components.revioLayout.settings.githubMigrated',
        'GitHub now uses the {{value0}} GitHub App; sign in again. Your old tokens were deleted from this Mac.',
        { value0: FORK_PRODUCT_NAME }
      )}
      <button
        type="button"
        data-revio-settings-text-button=""
        onClick={() => act(window.api.cloud?.githubDismissNotice)}
      >
        {translate('auto.components.revioLayout.settings.githubDismiss', 'Dismiss')}
      </button>
    </span>
  )
}

export function githubSignedOutText(): string {
  return translate(
    'auto.components.revioLayout.settings.githubSignInWhy',
    'Sign in with GitHub to use {{value0}} cloud workspaces. They push branches and open pull requests only in repositories where you install the {{value0}} GitHub App. The token stays on this Mac.',
    { value0: FORK_PRODUCT_NAME }
  )
}

export function githubConnectedLead(): string {
  return translate('auto.components.revioLayout.settings.githubConnectedTo', 'Connected to')
}

/**
 * GitHub for cloud workspaces as one account row: sign in with the fork's GitHub
 * App (device flow), then the connected account with its options menu and the per-owner install
 * list below. Tokens never reach the renderer. It lives on Settings > Account; `signedOutText`
 * replaces the cloud-only reason to sign in there.
 */
export function RevioCloudGithub({
  signedOutText
}: {
  signedOutText?: string
} = {}): React.JSX.Element {
  const controls = useCloudGithub()
  const { status, error, act } = controls
  const cloud = window.api.cloud
  const label = translate('auto.components.revioLayout.settings.github', 'GitHub')
  if (!status) {
    return (
      <RevioSettingRow
        label={label}
        description={error ? <GithubErrorLine message={error} /> : <GithubChecking />}
      />
    )
  }
  if (!status.app.configured) {
    return <RevioSettingRow label={label} description={status.app.message} />
  }
  const notice = <GithubNotice {...controls} status={status} />
  if (status.signIn) {
    return (
      <RevioSettingRow
        label={label}
        description={translate(
          'auto.components.revioLayout.settings.githubSignInSteps',
          'Approve {{value0}} on GitHub to finish signing in.',
          { value0: FORK_PRODUCT_NAME }
        )}
        hint={notice}
        control={<GithubWaitingControl onCancel={() => act(cloud?.githubCancelSignIn)} />}
        below={
          <GithubDeviceCode
            code={status.signIn.userCode}
            onOpen={() => act(cloud?.githubOpenVerification)}
          />
        }
      />
    )
  }
  if (!status.account) {
    return (
      <RevioSettingRow
        label={label}
        description={
          status.signInExpired ? <GithubExpiredLine /> : (signedOutText ?? githubSignedOutText())
        }
        hint={notice}
        control={
          <GithubSignInButton
            expired={status.signInExpired}
            onClick={() => act(cloud?.githubSignIn)}
          />
        }
      />
    )
  }
  const { host, authorizationsUrl } = status.app
  return (
    <RevioSettingRow
      label={label}
      description={
        <GithubAccountLine host={host} login={status.account.login} lead={githubConnectedLead()} />
      }
      hint={notice}
      control={
        <GithubAccountMenu
          onRevoke={() => void window.api.shell.openUrl(authorizationsUrl)}
          onSignOut={() => act(cloud?.githubSignOut)}
        />
      }
      below={
        <RevioCloudGithubRepos
          status={status}
          onInstall={(owner) => act(() => cloud?.githubInstall(owner) ?? Promise.resolve())}
          onRecheck={() => act(cloud?.githubRecheck)}
        />
      }
    />
  )
}
