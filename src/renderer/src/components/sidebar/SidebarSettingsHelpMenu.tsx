import React, { useState } from 'react'
import {
  Bug,
  CircleHelp,
  Keyboard,
  Loader2,
  MessageSquareText,
  RefreshCw,
  RotateCw,
  School,
  Settings,
  Stethoscope
} from 'lucide-react'
import { toast } from 'sonner'
import logo from '../../../../../resources/logo.svg'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useMountedRef } from '@/hooks/useMountedRef'
import { useShortcutKeyDetails } from '@/hooks/useShortcutLabel'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { showOnboardingFromRenderer } from '../onboarding/show-onboarding-event'
import { SetupGuideProgressRing } from '../setup-guide/SetupGuideProgressRing'
import { useSetupGuideProgress } from '../setup-guide/use-setup-guide-progress'
import { lazyWithRetry } from '@/lib/lazy-with-retry'
import { REVIO_SEND_FEEDBACK_EVENT } from '../revio-layout/revio-app-keys'
import { useRevioLayout } from '../revio-layout/revio-layout'
import { openRevioSettingsPage } from '../revio-layout/settings/revio-settings-view'
import type * as SidebarFeedbackDialogModule from './sidebar-feedback/SidebarFeedbackDialog'
import { translate } from '@/i18n/i18n'
import { getUpdateCheckClickOptions, getUpdateCheckHint } from '@/lib/update-check-click-options'
import { isAppUpdaterEnabled } from '../../../../shared/update-feed'
import { appFeedbackEntry, openAppFeedback } from '@/lib/app-feedback-entry'
import { releaseNoticeRepo } from '../../../../shared/release-notice'

// Keep feedback off the boot graph; menu warming and selection share the same lazy module entry.
const loadSidebarFeedbackDialog = (): Promise<typeof SidebarFeedbackDialogModule> =>
  import('./sidebar-feedback/SidebarFeedbackDialog')

const SidebarFeedbackDialog = lazyWithRetry(
  () => loadSidebarFeedbackDialog().then((module) => ({ default: module.SidebarFeedbackDialog })),
  { reloadKey: 'sidebar-feedback-dialog' }
)

const NO_UPDATE_CHECK_MODIFIERS = {
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false
}

export function SidebarSettingsHelpMenu(): React.JSX.Element {
  const openModal = useAppStore((s) => s.openModal)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const updateStatus = useAppStore((s) => s.updateStatus)
  // Packaged builds open DevTools only after the Advanced setting; main enforces it too.
  const debugToolsAllowed =
    useAppStore((s) => s.settings?.revioDebugTools === true) || import.meta.env.DEV
  const setupProgress = useSetupGuideProgress(true, false, false)

  const settingsShortcut = useShortcutKeyDetails('app.settings')
  const [menuOpen, setMenuOpen] = useState(false)
  const revioLayout = useRevioLayout()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  // Retain the mounted dialog through its closing animation.
  const [feedbackDialogMounted, setFeedbackDialogMounted] = useState(false)
  const [isRestartingOrca, setIsRestartingOrca] = useState(false)
  const lastShowOnboardingAtRef = React.useRef(0)
  const updateCheckModifiersRef = React.useRef(NO_UPDATE_CHECK_MODIFIERS)
  const mountedRef = useMountedRef()
  const updateCheckHint = getUpdateCheckHint()
  const feedbackEntry = appFeedbackEntry()

  // Milestones is the upstream guide; the workspace layout has its own first run instead.
  const showMilestones =
    !revioLayout && setupProgress.ready && setupProgress.coreDoneCount < setupProgress.coreTotal

  const handleMenuOpenChange = (open: boolean): void => {
    setMenuOpen(open)
    updateCheckModifiersRef.current = NO_UPDATE_CHECK_MODIFIERS
    if (open && feedbackEntry?.kind === 'dialog') {
      // Warm while users read the menu so feedback is loaded before selection.
      void loadSidebarFeedbackDialog().catch(() => {})
    }
  }

  const handleOpenFeedback = (): void => {
    openAppFeedback(() => {
      setFeedbackDialogMounted(true)
      setFeedbackOpen(true)
    })
  }

  // Workspace layout's ⌘⌥F "Send feedback" opens the same dialog.
  React.useEffect(() => {
    const open = (): void => {
      setFeedbackDialogMounted(true)
      setFeedbackOpen(true)
    }
    window.addEventListener(REVIO_SEND_FEEDBACK_EVENT, open)
    return () => window.removeEventListener(REVIO_SEND_FEEDBACK_EVENT, open)
  }, [])

  const handleShowOnboarding = (): void => {
    const now = Date.now()
    if (now - lastShowOnboardingAtRef.current < 500) {
      return
    }
    lastShowOnboardingAtRef.current = now
    void showOnboardingFromRenderer()
  }

  const handleRestartOrca = (): void => {
    if (isRestartingOrca) {
      return
    }
    setIsRestartingOrca(true)
    toast.info(
      translate(
        'auto.components.sidebar.SidebarSettingsHelpMenu.5161eef55d',
        'Restarting {{productName}}…'
      )
    )
    void window.api.app.restart().catch((error) => {
      if (mountedRef.current) {
        setIsRestartingOrca(false)
        toast.error(
          translate(
            'auto.components.sidebar.SidebarSettingsHelpMenu.4e8f5710d3',
            "Couldn't restart {{productName}}."
          ),
          {
            description: error instanceof Error ? error.message : undefined
          }
        )
      }
    })
  }

  const openShortcutsSettings = (): void => {
    if (revioLayout) {
      openSettingsPage()
      openRevioSettingsPage('shortcuts')
      return
    }
    openSettingsTarget({ pane: 'shortcuts', repoId: null })
    openSettingsPage()
  }

  const handleCheckForUpdatesPointerDown = (event: React.PointerEvent): void => {
    updateCheckModifiersRef.current = {
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    }
  }

  const handleCheckForUpdates = (): void => {
    const modifiers = updateCheckModifiersRef.current
    updateCheckModifiersRef.current = NO_UPDATE_CHECK_MODIFIERS
    void window.api.updater.check(getUpdateCheckClickOptions(modifiers))
  }

  const openMilestones = (): void => {
    openModal('setup-guide', { telemetrySource: 'help_menu' })
  }

  return (
    <>
      <div data-sidebar-settings-help="" className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              type="button"
              aria-label={translate(
                'auto.components.sidebar.SidebarSettingsHelpMenu.a428c25998',
                'Settings'
              )}
              className="text-muted-foreground"
              onClick={openSettingsPage}
            >
              <Settings className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4} className="flex items-center gap-1.5">
            {translate('auto.components.sidebar.SidebarSettingsHelpMenu.a428c25998', 'Settings')}
            {settingsShortcut.keys.length > 0 ? (
              <ShortcutKeyCombo
                keys={settingsShortcut.keys}
                doubleTap={settingsShortcut.doubleTap}
                className="gap-0.5"
                keyCapClassName="min-w-0 border-background/20 bg-background/10 px-1 py-0 text-[10px] text-background shadow-none"
                separatorClassName="text-[10px] text-background/70"
              />
            ) : null}
          </TooltipContent>
        </Tooltip>
        <DropdownMenu modal={false} open={menuOpen} onOpenChange={handleMenuOpenChange}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  type="button"
                  aria-label={translate(
                    'auto.components.sidebar.SidebarSettingsHelpMenu.2991a0106c',
                    'Help'
                  )}
                  className="text-muted-foreground"
                >
                  <CircleHelp className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {translate('auto.components.sidebar.SidebarSettingsHelpMenu.2991a0106c', 'Help')}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-52">
            <DropdownMenuItem onSelect={openShortcutsSettings}>
              <Keyboard className="size-3.5" />
              {translate(
                'auto.components.sidebar.SidebarSettingsHelpMenu.e565171a7c',
                'Keyboard Shortcuts'
              )}
            </DropdownMenuItem>
            {feedbackEntry ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleOpenFeedback}>
                  <MessageSquareText className="size-3.5" />
                  {feedbackEntry.kind === 'dialog'
                    ? translate(
                        'auto.components.sidebar.SidebarSettingsHelpMenu.4cf5b868d7',
                        'Send Feedback'
                      )
                    : translate(
                        'auto.components.sidebar.SidebarSettingsHelpMenu.reportIssue',
                        'Report an Issue'
                      )}
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuSeparator />
            )}
            {revioLayout ? (
              <DropdownMenuItem
                onSelect={() => {
                  openSettingsPage()
                  openRevioSettingsPage('advanced')
                }}
              >
                <Stethoscope className="size-3.5" />
                {translate('auto.components.revioLayout.settings.diagnostics', 'Diagnostics')}
              </DropdownMenuItem>
            ) : null}
            {revioLayout && window.api.githubRepos && debugToolsAllowed ? (
              <DropdownMenuItem onSelect={() => void window.api.githubRepos?.toggleDevTools()}>
                <Bug className="size-3.5" />
                {translate('auto.components.revioLayout.openDebugTools', 'Open debug tools')}
              </DropdownMenuItem>
            ) : null}
            {showMilestones ? (
              <DropdownMenuItem onSelect={openMilestones}>
                <img
                  src={logo}
                  alt=""
                  aria-hidden="true"
                  className="size-3.5 object-contain invert opacity-55 dark:invert-0"
                />
                {translate(
                  'auto.components.sidebar.SidebarSettingsHelpMenu.f8a2c91d4e',
                  'Milestones'
                )}
                <SetupGuideProgressRing
                  done={setupProgress.coreDoneCount}
                  total={setupProgress.coreTotal}
                  sizeClassName="size-4"
                  className="ml-auto"
                />
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              className="whitespace-nowrap"
              onClick={handleShowOnboarding}
              onSelect={handleShowOnboarding}
            >
              <School className="size-3.5" />
              {translate(
                'auto.components.sidebar.SidebarSettingsHelpMenu.b7e4d2a19c',
                'Onboarding'
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {isAppUpdaterEnabled() ? (
              <DropdownMenuItem
                disabled={updateStatus.state === 'checking' || updateStatus.state === 'downloading'}
                onPointerDown={handleCheckForUpdatesPointerDown}
                onSelect={handleCheckForUpdates}
                title={updateCheckHint}
              >
                {updateStatus.state === 'checking' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                {translate(
                  'auto.components.sidebar.SidebarSettingsHelpMenu.29c56f30ee',
                  'Check for Updates'
                )}
              </DropdownMenuItem>
            ) : releaseNoticeRepo() ? (
              // No self-updater in this build: ask the releases page and say what it found.
              <DropdownMenuItem onSelect={() => void window.api.releaseNotice?.check()}>
                <RefreshCw className="size-3.5" />
                {translate(
                  'auto.components.sidebar.SidebarSettingsHelpMenu.29c56f30ee',
                  'Check for Updates'
                )}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>
                <RefreshCw className="size-3.5" />
                {translate(
                  'auto.components.sidebar.SidebarSettingsHelpMenu.updatesManagedByTeam',
                  'Updates are managed by your team'
                )}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleRestartOrca} disabled={isRestartingOrca}>
              <RotateCw className="size-3.5" />
              {translate(
                'auto.components.sidebar.SidebarSettingsHelpMenu.ad3d3ed7f1',
                'Restart {{productName}}'
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {feedbackDialogMounted ? (
        <React.Suspense fallback={null}>
          <SidebarFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
        </React.Suspense>
      ) : null}
    </>
  )
}
