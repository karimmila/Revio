import React from 'react'
import { Copy, ExternalLink, FolderGit2, KeyRound, Link2, Pencil } from 'lucide-react'
import { useAppStore } from '@/store'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Worktree } from '../../../../shared/worktree/types'
import { useRepoActionRuns, worktreeHasRunningAction } from '@/lib/repo-action-run'
import { copyRevioLink } from './RevioLinkRouter'
import { openRevioPullRequest } from './open-revio-pull-request'
import { openRevioSettingsPage } from './settings/revio-settings-view'
import { usePullRequestForActiveWorkspace } from './use-revio-pull-request'
import { useSetupStatus } from './revio-setup-status'
import type { SetupStatus } from '../../../../shared/setup-status'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'

function createdLabel(createdAt: number | undefined): string | null {
  return createdAt ? new Date(createdAt).toLocaleString(getIntlLocale()) : null
}

/** "Setup" line in Workspace actions; null when this workspace ran no setup. */
export function setupInfoLabel(status: SetupStatus | null): string | null {
  if (status === 'failed') {
    return translate('auto.components.revioLayout.setupInfoFailed', 'Setup failed')
  }
  if (status === 'running') {
    return translate('auto.components.revioLayout.setupInfoRunning', 'Setting up...')
  }
  return status === 'succeeded'
    ? translate('auto.components.revioLayout.setupInfoSucceeded', 'Setup succeeded')
    : null
}

/** Whether a Run action is live in the workspace; re-read when its tabs change or its script exits. */
function useRunning(worktreeId: string): boolean {
  useAppStore((s) => s.tabsByWorktree[worktreeId]?.length ?? 0)
  // A workspace-layout run lives in the dock, whose tabs belong to the floating workspace.
  useAppStore((s) => s.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID]?.length ?? 0)
  useRepoActionRuns()
  return worktreeHasRunningAction(worktreeId)
}

/**
 * The top-bar title: the workspace name opens a card with its branch, repository and run
 * state ("· Running"), and Copy link.
 */
export function RevioWorkspaceTitle({
  worktree,
  repoName,
  label
}: {
  worktree: Worktree
  repoName: string
  label: string
}): React.JSX.Element {
  const running = useRunning(worktree.id)
  const branch = worktree.branch.replace(/^refs\/heads\//, '')
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="min-w-0 truncate rounded-md px-1 text-[13px] text-foreground/80 transition-colors hover:bg-accent [-webkit-app-region:no-drag]"
        >
          {label}
          {running ? (
            <span className="text-muted-foreground">
              {' · '}
              {translate('auto.components.revioLayout.titleRunning', 'Running')}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} data-revio-title-card="" className="w-72">
        <div className="font-medium text-foreground">{worktree.displayName}</div>
        <div className="mt-0.5 truncate text-muted-foreground">
          {[repoName, branch].filter(Boolean).join(' · ')}
          {running ? ` · ${translate('auto.components.revioLayout.titleRunning', 'Running')}` : ''}
        </div>
        <button
          type="button"
          className="mt-2 flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => copyRevioLink({ worktreeId: worktree.id })}
        >
          <Link2 className="size-3.5" />
          {translate('auto.components.revioLayout.copyLink', 'Copy link')}
        </button>
      </PopoverContent>
    </Popover>
  )
}

/** The rest of the "Workspace actions" menu, above Open in and Archive. */
export function RevioWorkspaceActionsItems({
  worktree
}: {
  worktree: Worktree
}): React.JSX.Element {
  const pr = usePullRequestForActiveWorkspace()
  const created = createdLabel(worktree.createdAt)
  const setupStatus = useSetupStatus(worktree.path)
  const setup = setupInfoLabel(setupStatus)
  return (
    <>
      <DropdownMenuItem onSelect={() => useAppStore.getState().setRenamingWorktreeId(worktree.id)}>
        <Pencil className="size-3.5" />
        {translate('auto.components.revioLayout.renameWorkspaceFull', 'Rename workspace')}
      </DropdownMenuItem>
      {pr?.url ? (
        <DropdownMenuItem onSelect={() => openRevioPullRequest(pr.url)}>
          <ExternalLink className="size-3.5" />
          {translate('auto.components.revioLayout.openOnGitHub', 'Open on GitHub')}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem onSelect={() => openRevioSettingsPage(`repo:${worktree.repoId}`)}>
        <FolderGit2 className="size-3.5" />
        {translate('auto.components.revioLayout.repositorySettings', 'Repository')}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => openRevioSettingsPage('environment')}>
        <KeyRound className="size-3.5" />
        {translate('auto.components.revioLayout.environment', 'Environment')}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => copyRevioLink({ worktreeId: worktree.id })}>
        <Copy className="size-3.5" />
        {translate('auto.components.revioLayout.copyLink', 'Copy link')}
      </DropdownMenuItem>
      {setup ? (
        <DropdownMenuLabel
          data-revio-menu-note=""
          data-revio-setup-failed={setupStatus === 'failed' ? '' : undefined}
        >
          {translate('auto.components.revioLayout.setupInfo', 'Setup: {{value0}}', {
            value0: setup
          })}
        </DropdownMenuLabel>
      ) : null}
      {created ? (
        <DropdownMenuLabel data-revio-menu-note="">
          {translate('auto.components.revioLayout.createdAt', 'Created {{value0}}', {
            value0: created
          })}
        </DropdownMenuLabel>
      ) : null}
    </>
  )
}
