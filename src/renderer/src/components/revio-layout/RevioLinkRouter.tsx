import React from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { cloudEnvironmentIdsNow, isCloudRepo } from '@/lib/cloud-workspaces'
import { openWorkspaceCreationComposerWithTourHandoff } from '@/components/contextual-tours/workspace-creation-tour-handoff'
import { equipSharedLoadout } from './loadouts/equip-shared-loadout'
import { revioSettingsPageFrom, openRevioSettingsPage } from './settings/revio-settings-view'
import {
  buildRevioLink,
  parseRevioLink,
  parseRevioRoute,
  type RevioLink
} from '../../../../shared/revio-link'

const REVIO_LINK_NOT_FOUND_EVENT = 'orca:revio-link-not-found'

/** Opens the workspace, and the chat, a "Copy link" names; false when it is not here. */
export async function openRevioLink(raw: string): Promise<boolean> {
  const route = parseRevioRoute(raw)
  if (route?.kind === 'settings') {
    useAppStore.getState().openSettingsPage()
    openRevioSettingsPage(revioSettingsPageFrom(route.page))
    return true
  }
  if (route?.kind === 'create') {
    openWorkspaceCreationComposerWithTourHandoff()
    return true
  }
  if (route?.kind === 'loadout') {
    await equipSharedLoadout(route.loadout)
    return true
  }
  const link = parseRevioLink(raw)
  const state = useAppStore.getState()
  const worktree = link ? findWorktreeById(selectWorktreesByRepo(state), link.worktreeId) : null
  const repo = worktree ? state.repos.find((entry) => entry.id === worktree.repoId) : null
  if (!link || !worktree || !repo) {
    window.dispatchEvent(new Event(REVIO_LINK_NOT_FOUND_EVENT))
    return false
  }
  // Each location lists only its own workspaces, so switch to the one the link points into.
  const location = isCloudRepo(repo, cloudEnvironmentIdsNow()) ? 'cloud' : 'local'
  if (state.settings?.revioLocation !== location) {
    await state.updateSettings({ revioLocation: location })
  }
  activateAndRevealWorktree(worktree.id, { sidebarRevealBehavior: 'auto' })
  const chat = link.sessionId
    ? useAppStore
        .getState()
        .unifiedTabsByWorktree[worktree.id]?.find((tab) => tab.entityId === link.sessionId)
    : undefined
  if (chat) {
    useAppStore.getState().activateTab(chat.id, { worktreeId: worktree.id })
  }
  return true
}

export function copyRevioLink(link: RevioLink): void {
  window.api.ui.writeClipboardText(buildRevioLink(link))
  toast.success(translate('auto.components.revioLayout.linkCopied', 'Link copied'))
}

/** "Workspace not found" page for a link to a workspace this Orca does not have. */
function WorkspaceNotFound(): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    const show = (): void => setOpen(true)
    window.addEventListener(REVIO_LINK_NOT_FOUND_EVENT, show)
    return () => window.removeEventListener(REVIO_LINK_NOT_FOUND_EVENT, show)
  }, [])
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {translate('auto.components.revioLayout.workspaceNotFound', 'Workspace not found')}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.revioLayout.linkNotHere',
              'That workspace is not in this {{productName}}.'
            )}{' '}
            {translate(
              'auto.components.revioLayout.workspaceNotFoundHint',
              'It may have been archived, or it lives on another computer.'
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              setOpen(false)
              const state = useAppStore.getState()
              state.setActiveView('terminal')
              state.setActiveWorktree(null)
            }}
          >
            {translate('auto.components.revioLayout.goHome', 'Go to Home')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Routes `revio://workspace` links, pushed while running or waiting from launch. */
export function RevioLinkRouter(): React.JSX.Element {
  React.useEffect(() => {
    // Hosts and harnesses without these bridges (the web client, tests) route no links.
    const ui = window.api?.ui
    void ui?.consumePendingRevioLink?.().then((link) => {
      if (link) {
        void openRevioLink(link)
      }
    })
    return ui?.onOpenRevioLink?.((link) => void openRevioLink(link))
  }, [])
  return <WorkspaceNotFound />
}
