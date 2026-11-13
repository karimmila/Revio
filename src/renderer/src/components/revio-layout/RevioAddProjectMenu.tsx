import React from 'react'
import { FolderOpen, FolderPlus, Globe, Rocket } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useRecentProjects } from './revio-recent-projects'

/**
 * The sidebar Add project menu: open a folder, clone from GitHub, start a new project,
 * and the projects opened before that are closed now.
 */
export function RevioAddProjectMenu({
  preserveWorkspaceBoardOpen
}: {
  preserveWorkspaceBoardOpen: boolean
}): React.JSX.Element {
  const recents = useRecentProjects()
  const label = translate('auto.components.sidebar.SidebarHeader.addProject', 'Add project')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          className="text-muted-foreground"
          aria-label={label}
          title={label}
          data-workspace-board-preserve-open={preserveWorkspaceBoardOpen ? '' : undefined}
        >
          <FolderPlus className="size-3.5" strokeWidth={2.25} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => void useAppStore.getState().addRepo()}>
          <FolderOpen className="size-3.5" />
          {translate('auto.components.revioLayout.openProject', 'Open project')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => useAppStore.getState().openModal('add-repo', { startStep: 'clone' })}
        >
          <Globe className="size-3.5" />
          {translate('auto.components.revioLayout.openGitHubProject', 'Open GitHub project')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => useAppStore.getState().openModal('add-repo', { startStep: 'create' })}
        >
          <Rocket className="size-3.5" />
          {translate('auto.components.revioLayout.quickStart', 'Quick start')}
        </DropdownMenuItem>
        {recents.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>
              {translate('auto.components.revioLayout.recents', 'Recents')}
            </DropdownMenuLabel>
            {recents.map((recent) => (
              <DropdownMenuItem
                key={recent.path}
                title={recent.path}
                onSelect={() => void useAppStore.getState().addRepoPath(recent.path)}
              >
                <FolderOpen className="size-3.5 text-muted-foreground" />
                <span className="truncate">{recent.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
