import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Archive,
  Copy,
  GitBranch,
  Link,
  Mail,
  MailOpen,
  Moon,
  Pencil,
  Pin,
  PinOff,
  Terminal
} from 'lucide-react'
import { useAppStore } from '@/store'
import { isCloudRepo, useCloudEnvironmentIds } from '@/lib/cloud-workspaces'
import { translate } from '@/i18n/i18n'
import { useOptionalShortcutLabel } from '@/hooks/useShortcutLabel'
import { CLOSE_ALL_CONTEXT_MENUS_EVENT } from '@/lib/close-all-context-menus'
import { WorktreeRowOpenInSubMenu } from '@/components/sidebar/workspace-actions/open/WorktreeRowOpenInSubMenu'
import { copyRevioLink } from './RevioLinkRouter'
import { copyCloudSshCommand } from './copy-cloud-ssh-command'
import { RevioLinkWorkMenuItems } from './RevioLinkWorkMenuItems'
import { WorktreeStatusMenuItems } from '@/components/sidebar/workspace-status/presentation/WorktreeStatusMenuItems'
import { WorktreeContextMenuOverlays } from '@/components/sidebar/workspace-actions/context-menu/WorktreeContextMenuOverlays'
import { isEventTargetInsideCurrentTarget } from '@/components/sidebar/workspace-card/controller/worktree-card-dom-events'
import type { WorktreeContextMenuModel } from '@/components/sidebar/workspace-actions/context-menu/use-worktree-context-menu-model'
import {
  WORKTREE_CONTEXT_MENU_SCOPE_ATTR,
  shouldIgnoreNestedWorktreeContextMenuScope,
  shouldUseNativeContextMenu
} from '@/components/sidebar/workspace-actions/context-menu/worktree-context-menu-policy'
import { RevioRenameBranchDialog } from './RevioRenameBranchDialog'
import { showAsleepViewAfterSleep } from './revio-asleep-view'
import { refreshAsleepCloudEnvironmentsSoon } from '@/lib/cloud-asleep-environments'
import { RevioMoveToSectionMenu } from './RevioSectionMenu'

const COPY_LINK_SHORTCUT = '⌘⇧C'

/**
 * The workspace menu, in its order: read state, pin, status, rename, branch, open and
 * copy, then Archive. Every action is Orca's own handler from the shared menu model.
 */
export function RevioWorktreeContextMenuView({
  model
}: {
  model: WorktreeContextMenuModel
}): React.JSX.Element {
  const { worktree, repo, isDeleting, menuOpen, menuPoint, scopeRef } = model
  const [renameBranchOpen, setRenameBranchOpen] = React.useState(false)
  const archiveShortcut = useOptionalShortcutLabel('workspace.delete')
  const hasBranch = worktree.branch.length > 0 && !worktree.isMainWorktree
  const cloudEnvironmentIds = useCloudEnvironmentIds()
  // A cloud workspace's Sleep stops its sandbox (files kept); opening it again resumes it.
  const cloud = repo ? isCloudRepo(repo, cloudEnvironmentIds) : false
  return (
    <div
      ref={scopeRef}
      className="relative"
      {...{ [WORKTREE_CONTEXT_MENU_SCOPE_ATTR]: 'worktree' }}
      onContextMenuCapture={(event) => {
        if (
          !isEventTargetInsideCurrentTarget(event.currentTarget, event.target) ||
          shouldUseNativeContextMenu(event.target) ||
          shouldIgnoreNestedWorktreeContextMenuScope(event.currentTarget, event.target)
        ) {
          return
        }
        event.preventDefault()
        model.contextMenuOpenedAtRef.current = Date.now()
        window.dispatchEvent(new Event(CLOSE_ALL_CONTEXT_MENUS_EVENT))
        model.setContextWorktrees(
          model.onContextMenuSelect?.(event) ?? model.effectiveSelectedWorktrees
        )
        const bounds = event.currentTarget.getBoundingClientRect()
        model.setMenuPoint({ x: event.clientX - bounds.left, y: event.clientY - bounds.top })
        model.setMenuOpenState(true)
      }}
      onClickCapture={model.suppressOpeningPointerEvent}
    >
      {model.children}
      <DropdownMenu open={menuOpen} onOpenChange={model.setMenuOpenState} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            aria-hidden
            tabIndex={-1}
            className="pointer-events-none absolute size-px opacity-0"
            style={{ left: menuPoint.x, top: menuPoint.y }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="min-w-56"
          data-revio-menu=""
          sideOffset={0}
          align="start"
          onPointerUpCapture={model.suppressOpeningPointerEvent}
          onPointerDownCapture={(event) => {
            if (event.button === 0) {
              model.contextMenuOpenedAtRef.current = null
            }
          }}
          onMouseUpCapture={model.suppressOpeningPointerEvent}
          onClickCapture={model.suppressOpeningPointerEvent}
          onCloseAutoFocus={model.handleCloseAutoFocus}
          onKeyDown={(event) => {
            // The single-key menu shortcuts: R read state, P pin.
            const key = event.key.toLowerCase()
            if (isDeleting || event.metaKey || event.ctrlKey || event.altKey) {
              return
            }
            if (key === 'r' || key === 'p') {
              event.preventDefault()
              if (key === 'r') {
                model.handleToggleRead()
              } else {
                model.handleTogglePin()
              }
              model.setMenuOpenState(false)
            }
          }}
        >
          <DropdownMenuItem onSelect={model.handleToggleRead} disabled={isDeleting}>
            {worktree.isUnread ? <MailOpen className="size-3.5" /> : <Mail className="size-3.5" />}
            {worktree.isUnread
              ? translate('auto.components.revioLayout.markRead', 'Mark as read')
              : translate('auto.components.revioLayout.markUnread', 'Mark as unread')}
            <DropdownMenuShortcut>R</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={model.handleTogglePin} disabled={isDeleting}>
            {worktree.isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            {worktree.isPinned
              ? translate('auto.components.revioLayout.unpin', 'Unpin')
              : translate('auto.components.revioLayout.pin', 'Pin')}
            <DropdownMenuShortcut>P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <WorktreeStatusMenuItems
            contextWorkspaceStatus={model.contextWorkspaceStatus}
            deletingContext={model.deletingContext}
            isMultiContext={false}
            onAssignWorkspaceStatus={model.handleAssignWorkspaceStatus}
            workspaceStatuses={model.workspaceStatuses}
            label={translate('auto.components.revioLayout.setStatus', 'Set status')}
          />
          <RevioMoveToSectionMenu worktreeId={worktree.id} disabled={isDeleting} />
          <DropdownMenuItem
            onSelect={() => useAppStore.getState().setRenamingWorktreeId(worktree.id)}
            disabled={isDeleting}
          >
            <Pencil className="size-3.5" />
            {translate('auto.components.revioLayout.renameWorkspace', 'Rename')}
          </DropdownMenuItem>
          {hasBranch ? (
            <DropdownMenuItem onSelect={() => setRenameBranchOpen(true)} disabled={isDeleting}>
              <GitBranch className="size-3.5" />
              {translate('auto.components.revioLayout.renameBranch', 'Rename branch…')}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <WorktreeRowOpenInSubMenu
            worktree={worktree}
            connectionId={repo?.connectionId ?? null}
            disabled={isDeleting}
          />
          <DropdownMenuItem onSelect={() => copyRevioLink({ worktreeId: worktree.id })}>
            <Link className="size-3.5" />
            {translate('auto.components.revioLayout.copyLink', 'Copy link')}
            <DropdownMenuShortcut>{COPY_LINK_SHORTCUT}</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={model.handleCopyPath} disabled={isDeleting}>
            <Copy className="size-3.5" />
            {translate('auto.components.revioLayout.copyPath', 'Copy path')}
          </DropdownMenuItem>
          {hasBranch ? (
            <DropdownMenuItem
              onSelect={() =>
                window.api.ui.writeClipboardText(worktree.branch.replace(/^refs\/heads\//, ''))
              }
            >
              <Copy className="size-3.5" />
              {translate('auto.components.revioLayout.copyBranch', 'Copy branch name')}
            </DropdownMenuItem>
          ) : null}
          <RevioLinkWorkMenuItems worktree={worktree} disabled={isDeleting} />
          <DropdownMenuSeparator />
          {cloud ? (
            <DropdownMenuItem onSelect={() => void copyCloudSshCommand(worktree.id)}>
              <Terminal className="size-3.5" />
              {translate('auto.components.revioLayout.copySshCommand', 'Copy SSH command')}
            </DropdownMenuItem>
          ) : null}
          {cloud ? (
            <DropdownMenuItem
              onSelect={() => {
                // Sleep takes the workspace off screen; it stays the selected one, asleep.
                if (
                  useAppStore.getState().activeWorktreeId === worktree.id &&
                  model.sleepableWorktrees.some((item) => item.id === worktree.id)
                ) {
                  showAsleepViewAfterSleep(worktree.id)
                }
                refreshAsleepCloudEnvironmentsSoon()
                model.handleCloseTerminals()
              }}
              disabled={isDeleting}
            >
              <Moon className="size-3.5" />
              {translate('auto.components.revioLayout.sleepCloud', 'Sleep')}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={model.handleDelete}
            disabled={
              model.contextDeletePending ||
              (worktree.isMainWorktree && worktree.ephemeralVmCheckoutMode !== 'provisioned-root')
            }
          >
            <Archive className="size-3.5" />
            {translate('auto.components.revioLayout.archive', 'Archive')}
            {archiveShortcut ? (
              <DropdownMenuShortcut>{archiveShortcut}</DropdownMenuShortcut>
            ) : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <WorktreeContextMenuOverlays model={model} />
      <RevioRenameBranchDialog
        worktree={worktree}
        connectionId={repo?.connectionId ?? null}
        open={renameBranchOpen}
        onOpenChange={setRenameBranchOpen}
      />
    </div>
  )
}
