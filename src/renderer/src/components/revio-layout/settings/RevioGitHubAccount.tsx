import React from 'react'
import { translate } from '@/i18n/i18n'
import { openRevioSettingsPage } from './revio-settings-view'
import { useCloudGithub } from './use-cloud-github'

/**
 * The GitHub line on Settings > Cloud: the GitHub App sign-in that every GitHub feature uses,
 * local and cloud. Signing in and installing the app live in Settings > Account; this row points
 * there.
 */
export function RevioGitHubAccount(): React.JSX.Element {
  const { status, error } = useCloudGithub()
  const login = status?.account?.login ?? null
  const label =
    status === null
      ? translate('auto.components.revioLayout.settings.checking', 'Checking…')
      : login
        ? translate('auto.components.revioLayout.settings.connectedAs', 'Connected as {{value0}}', {
            value0: login
          })
        : status.signInExpired
          ? translate(
              'auto.components.revioLayout.settings.githubSignInExpired',
              'GitHub sign-in expired'
            )
          : translate('auto.components.revioLayout.settings.githubSignedOut', 'Not signed in')
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <span data-revio-settings-status="" data-github-state={login ? 'connected' : 'signed-out'}>
          {label}
        </span>
        <button
          type="button"
          data-revio-settings-button=""
          onClick={() => openRevioSettingsPage('account')}
        >
          {login
            ? translate('auto.components.revioLayout.settings.githubManage', 'Manage')
            : translate(
                'auto.components.revioLayout.settings.githubSignInButton',
                'Sign in with GitHub'
              )}
        </button>
      </div>
      {error ? (
        <span role="alert" className="max-w-80 text-right text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  )
}
