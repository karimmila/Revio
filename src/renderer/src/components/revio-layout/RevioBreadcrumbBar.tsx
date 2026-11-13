import React from 'react'
import { RevioPortsButton } from './RevioPortsButton'
import { RevioWorkspaceActionsItems, RevioWorkspaceTitle } from './RevioWorkspaceTitle'
import { RevioCloudWorkspaceButton } from './RevioCloudWorkspaceButton'
import { useCloudEnvironmentIds } from '@/lib/cloud-workspaces'
import { getRepoExecutionHostId, parseExecutionHostId } from '../../../../shared/execution-host'
import { Archive, ChevronDown, ChevronRight, FolderOpen, MoreHorizontal } from 'lucide-react'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreeCreationSurfaceShown } from '@/lib/workspace/creation/worktree-creation-surface'
import { revioWorkspaceLabel } from './revio-workspace-label'
import { usePullRequestForActiveWorkspace } from './use-revio-pull-request'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { resolveRepoHeaderColor } from '@/components/sidebar/worktree-list/rows/project-header-color'
import {
  WorktreeOpenInMenuItems,
  WorktreeOpenInSubMenu
} from '@/components/sidebar/workspace-actions/open/WorktreeOpenInMenu'
import { runWorktreeDelete } from '@/components/sidebar/workspace-actions/deletion/delete-worktree-flow'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

// Controls inside the draggable title row must opt out of window dragging.
const NO_DRAG = '[-webkit-app-region:no-drag]'
const ICON_BUTTON = cn(
  'flex h-6 items-center justify-center gap-0.5 rounded-md px-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
  NO_DRAG
)

/** ⌘⇧O asks the top bar to open its "Open in" menu. */
export const REVIO_OPEN_IN_MENU_EVENT = 'orca:revio-open-in-menu'

/** The center title row: repo › workspace, a workspace menu, and Open in. */
export function RevioBreadcrumbBar(): React.JSX.Element | null {
  // The creation card replaces the workspace view; naming the previously open workspace above it
  // read as if that workspace were being set up.
  const creationShown = useAppStore(selectWorktreeCreationSurfaceShown)
  const worktree = useAppStore((s) =>
    s.activeWorktreeId ? findWorktreeById(selectWorktreesByRepo(s), s.activeWorktreeId) : undefined
  )
  const repo = useAppStore((s) =>
    worktree ? s.repos.find((candidate) => candidate.id === worktree.repoId) : undefined
  )
  const cloudEnvironmentIds = useCloudEnvironmentIds()
  const pullRequestTitle = usePullRequestForActiveWorkspace()?.title ?? null
  const [openInOpen, setOpenInOpen] = React.useState(false)
  // ⌘⇧O opens this menu.
  React.useEffect(() => {
    const open = (): void => setOpenInOpen(true)
    window.addEventListener(REVIO_OPEN_IN_MENU_EVENT, open)
    return () => window.removeEventListener(REVIO_OPEN_IN_MENU_EVENT, open)
  }, [])
  if (!worktree || creationShown) {
    return null
  }
  const host = repo ? parseExecutionHostId(getRepoExecutionHostId(repo)) : null
  const cloudEnvironmentId =
    host?.kind === 'runtime' && cloudEnvironmentIds.has(host.environmentId)
      ? host.environmentId
      : null
  const folderName = revioWorkspaceLabel(worktree, cloudEnvironmentId !== null, pullRequestTitle)
  const repoName = repo?.displayName ?? ''
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-2 pl-3">
      {repo ? (
        <span className="inline-flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-[3px]">
          <RepoIconGlyph
            repoIcon={repo.repoIcon}
            color={resolveRepoHeaderColor(repo.badgeColor)}
            className="size-full"
          />
        </span>
      ) : null}
      <span className="shrink-0 text-[13px] text-foreground/80">{repoName}</span>
      <ChevronRight className="size-3 shrink-0 text-muted-foreground/70" />
      <RevioWorkspaceTitle worktree={worktree} repoName={repoName} label={folderName} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={translate('auto.components.revioLayout.workspaceMenu', 'Workspace menu')}
            className={ICON_BUTTON}
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="w-56">
          <RevioWorkspaceActionsItems worktree={worktree} />
          <DropdownMenuSeparator />
          <WorktreeOpenInSubMenu worktreePath={worktree.path} connectionId={repo?.connectionId} />
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => runWorktreeDelete(worktree.id)}>
            <Archive className="size-3.5" />
            {translate('auto.components.revioLayout.archive', 'Archive')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {cloudEnvironmentId ? (
          <RevioCloudWorkspaceButton
            key={worktree.id}
            worktreeId={worktree.id}
            environmentId={cloudEnvironmentId}
            className={cn(ICON_BUTTON, 'rounded-md px-1.5')}
          />
        ) : null}
        <RevioPortsButton className={cn(ICON_BUTTON, 'rounded-md px-1.5')} />
        <DropdownMenu open={openInOpen} onOpenChange={setOpenInOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={translate(
                'auto.components.sidebar.WorktreeOpenInMenu.8009ab69a6',
                'Open in'
              )}
              title={translate('auto.components.revioLayout.openInShortcut', 'Open in (⌘⇧O)')}
              className={cn(ICON_BUTTON, 'rounded-md border border-border px-1.5')}
            >
              <FolderOpen className="size-3.5" />
              <ChevronDown className="size-3 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-52">
            <WorktreeOpenInMenuItems
              worktreePath={worktree.path}
              connectionId={repo?.connectionId}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
