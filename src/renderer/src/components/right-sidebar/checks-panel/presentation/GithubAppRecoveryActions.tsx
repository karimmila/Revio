import React from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { openRevioSettingsPage } from '@/components/revio-layout/settings/revio-settings-view'
import type { ChecksPanelRecoveryAction } from '../checks-panel-review-state-model'

export function hasGithubAppRecovery(recovery: readonly ChecksPanelRecoveryAction[]): boolean {
  return recovery.includes('github_sign_in') || recovery.includes('install_app')
}

/** Sign in, or install the app on the owner: the only ways out of the GitHub App states. */
export function GithubAppRecoveryActions({
  recovery,
  installOwner
}: {
  recovery: readonly ChecksPanelRecoveryAction[]
  installOwner: string | undefined
}): React.JSX.Element | null {
  const openGithubSettings = (): void => {
    useAppStore.getState().openSettingsPage()
    openRevioSettingsPage('account')
  }
  return (
    <>
      {recovery.includes('github_sign_in') ? (
        <Button size="xs" onClick={openGithubSettings}>
          {translate(
            'auto.components.right.sidebar.ChecksPanel.review.githubSignIn',
            'Sign in with GitHub'
          )}
        </Button>
      ) : null}
      {recovery.includes('install_app') ? (
        <Button
          size="xs"
          onClick={() =>
            installOwner
              ? void window.api.cloud?.githubInstall(installOwner).catch(openGithubSettings)
              : openGithubSettings()
          }
        >
          {translate('auto.components.right.sidebar.ChecksPanel.review.installApp', 'Install app')}
        </Button>
      ) : null}
    </>
  )
}
