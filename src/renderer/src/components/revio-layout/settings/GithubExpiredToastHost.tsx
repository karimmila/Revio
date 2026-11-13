import React from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { openRevioSettingsPage } from './revio-settings-view'

const TOAST_ID = 'cloud-github-expired'

/**
 * One toast when the GitHub sign-in lapses or the keychain refuses to unseal it, wherever the person is: running cloud workspaces stop
 * pushing at that moment, and Settings only says so to someone who looks. Main sends `expired` once
 * per lapse, and the fixed id keeps a second window's copy from stacking.
 */
export function GithubExpiredToastHost(): null {
  React.useEffect(
    () =>
      window.api.cloud?.onGithubEvent((event) => {
        if (event.keychainRefused) {
          toast.warning(
            translate(
              'auto.components.revioLayout.settings.githubKeychainRefusedToast',
              'The keychain did not unlock your GitHub sign-in, so GitHub features are paused'
            ),
            {
              id: TOAST_ID,
              duration: Infinity,
              action: {
                label: translate(
                  'auto.components.revioLayout.settings.githubOpenCloudSettings',
                  'Open settings'
                ),
                onClick: () => {
                  useAppStore.getState().openSettingsPage()
                  openRevioSettingsPage('account')
                }
              }
            }
          )
          return
        }
        if (!event.expired) {
          // Signed in again from anywhere: the warning has done its job.
          void window.api.cloud?.githubStatus().then((status) => {
            if (status.account) {
              toast.dismiss(TOAST_ID)
            }
          })
          return
        }
        toast.warning(
          translate(
            'auto.components.revioLayout.settings.githubExpiredToast',
            'GitHub access expired; sign in again to keep cloud workspaces pushing'
          ),
          {
            id: TOAST_ID,
            duration: Infinity,
            action: {
              label: translate(
                'auto.components.revioLayout.settings.githubSignInAgain',
                'Sign in again'
              ),
              onClick: () => {
                useAppStore.getState().openSettingsPage()
                openRevioSettingsPage('account')
              }
            }
          }
        )
      }),
    []
  )
  return null
}
