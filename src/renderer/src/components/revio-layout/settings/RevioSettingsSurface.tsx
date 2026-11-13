import React from 'react'
import { useAppStore } from '@/store'
import { lazyWithRetry as lazy } from '@/lib/lazy-with-retry'
import {
  openRevioSettingsPage,
  resetRevioSettingsView,
  revioSettingsPageForTarget
} from './revio-settings-view'

const RevioSettings = lazy(() => import('./RevioSettings'))
const RemoveFolderDialog = lazy(() => import('@/components/sidebar/RemoveFolderDialog'))

/**
 * The left sidebar mounts the "Remove Project" confirm, and the sidebar is not on screen while
 * settings are, so the confirm showed only after Back. Settings mounts it for its own Remove.
 */
export function RevioSettingsDialogs(): React.JSX.Element | null {
  const removing = useAppStore((s) => s.activeModal === 'confirm-remove-folder')
  return removing ? (
    <React.Suspense fallback={null}>
      <RemoveFolderDialog />
    </React.Suspense>
  ) : null
}

/**
 * Settings in the workspace layout: this layout's own pages only. A deep link into an upstream
 * pane (from a notice or a command) opens the page here that holds that setting.
 */
export function RevioSettingsSurface(): React.JSX.Element {
  const target = useAppStore((s) => s.settingsNavigationTarget)

  React.useEffect(() => {
    if (target) {
      openRevioSettingsPage(revioSettingsPageForTarget(target))
      useAppStore.getState().clearSettingsTarget()
    }
  }, [target])
  // Leaving settings starts the next visit on General. Only a real leave resets: React's dev
  // StrictMode unmounts once while settings stay open, which used to drop a deep link's page.
  React.useEffect(
    () => () => {
      if (useAppStore.getState().activeView !== 'settings') {
        resetRevioSettingsView()
      }
    },
    []
  )

  return (
    <>
      <RevioSettings />
      <RevioSettingsDialogs />
    </>
  )
}
