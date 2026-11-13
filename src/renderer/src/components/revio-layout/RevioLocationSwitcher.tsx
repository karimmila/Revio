import React from 'react'
import { Check, ChevronDown, Cloud, Settings } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { refreshCloudEnvironmentIds, useReportCloudActivity } from '@/lib/cloud-workspaces'
import { openRevioSettingsPage } from './settings/revio-settings-view'
import { useRevioLocationFocus } from './use-revio-location-focus'
import { useRetireCenterDesktopTabs } from '@/lib/cloud-desktop'

type Location = 'local' | 'cloud'

function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
  return letters.join('') || 'O'
}

function LocationMark({ location, name }: { location: Location; name: string }): React.JSX.Element {
  return (
    <span className="flex size-[15px] shrink-0 items-center justify-center rounded-full bg-worktree-sidebar-foreground/15 text-[8px] font-semibold">
      {location === 'cloud' ? <Cloud className="size-2.5" strokeWidth={2} /> : initialsOf(name)}
    </span>
  )
}

/** Vercel's sign-in state, read when the Cloud location is shown. Null while unknown. */
function useVercelConnected(active: boolean): 'connected' | 'disconnected' | 'error' | null {
  const [connected, setConnected] = React.useState<'connected' | 'disconnected' | 'error' | null>(
    null
  )
  React.useEffect(() => {
    if (!active) {
      return
    }
    let live = true
    void window.api.vercelCloud
      ?.status()
      // Signed in without a team picked still needs Settings > Cloud.
      .then(
        (status) =>
          live && setConnected(status.state === 'choose-team' ? 'disconnected' : status.state)
      )
      .catch(() => live && setConnected('error'))
    return () => {
      live = false
    }
  }, [active])
  return connected
}

export function openCloudSettings(page: 'cloud' | 'account' | `repo:${string}` = 'cloud'): void {
  useAppStore.getState().openSettingsPage()
  openRevioSettingsPage(page)
}

/**
 * The account switcher: this Mac or the cloud. The choice decides which workspaces the
 * sidebar lists and where Create makes a new one. ⌃1 and ⌃2 switch.
 */
export function RevioLocationSwitcher(): React.JSX.Element {
  const updateSettings = useAppStore((s) => s.updateSettings)
  const location: Location = useAppStore((s) =>
    s.settings?.revioLocation === 'cloud' ? 'cloud' : 'local'
  )
  const repoCount = useAppStore((s) => s.repos.length)
  const machineName = useAppStore(
    (s) =>
      s.settings?.machineName?.trim() ||
      translate('auto.components.revioLayout.localMac', 'Local Mac')
  )
  const cloudLabel = translate('auto.components.revioLayout.cloudLocation', 'Cloud')
  const vercelConnected = useVercelConnected(location === 'cloud')
  const choose = React.useCallback(
    (next: Location) => void updateSettings({ revioLocation: next }),
    [updateSettings]
  )
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  useReportCloudActivity(useAppStore)
  useRevioLocationFocus(location)
  useRetireCenterDesktopTabs()
  React.useEffect(() => {
    void refreshCloudEnvironmentIds()
  }, [location, repoCount])
  React.useEffect(() => {
    // Opening a cloud workspace first records any sandbox Vercel stopped on its own, so the open
    // resumes it instead of dialling a stopped session.
    if (location === 'cloud' && activeWorktreeId) {
      void window.api.cloud?.reconcileSessions()
    }
  }, [activeWorktreeId, location])
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return
      }
      if (event.key === '1' || event.key === '2') {
        event.preventDefault()
        choose(event.key === '1' ? 'local' : 'cloud')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [choose])
  const current = location === 'cloud' ? cloudLabel : machineName
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-revio-location-switcher=""
            className="mb-0.5 flex h-[28px] w-full items-center gap-2 rounded-md bg-worktree-sidebar-foreground/5 px-1.5 text-left text-[13px] font-medium text-worktree-sidebar-foreground transition-colors hover:bg-worktree-sidebar-foreground/8"
          >
            <LocationMark location={location} name={machineName} />
            <span className="min-w-0 truncate">{current}</span>
            <ChevronDown className="size-3 shrink-0 text-worktree-sidebar-foreground/55" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {(['local', 'cloud'] as const).map((option) => (
            <DropdownMenuItem key={option} onSelect={() => choose(option)}>
              <LocationMark location={option} name={machineName} />
              <span className="min-w-0 flex-1 truncate">
                {option === 'cloud' ? cloudLabel : machineName}
              </span>
              {option === location ? <Check className="size-3.5" /> : null}
              <DropdownMenuShortcut>{option === 'local' ? '⌃1' : '⌃2'}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => useAppStore.getState().openSettingsPage()}>
            <Settings className="size-3.5" />
            {translate('auto.components.revioLayout.settings.title', 'Settings')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {location === 'cloud' &&
      (vercelConnected === 'disconnected' || vercelConnected === 'error') ? (
        <button
          type="button"
          data-revio-cloud-connect=""
          onClick={() => openCloudSettings('cloud')}
          className="mb-1 flex w-full items-center gap-2 rounded-md border border-dashed border-worktree-sidebar-border px-2 py-1.5 text-left text-[12px] text-worktree-sidebar-foreground/75 hover:bg-worktree-sidebar-foreground/6"
        >
          <Cloud className="size-3 shrink-0" />
          {vercelConnected === 'error'
            ? translate(
                'auto.components.revioLayout.reconnectVercelCta',
                'Vercel sign-in expired. Reconnect Vercel'
              )
            : translate(
                'auto.components.revioLayout.connectVercelCta',
                'Connect Vercel to run workspaces in the cloud'
              )}
        </button>
      ) : null}
    </>
  )
}
