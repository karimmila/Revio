import type React from 'react'
import { ChevronDown, Rocket } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { PRInfo } from '../../../../shared/github/pull-request-types'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { useDeployments } from './RevioChecksExtras'
import { viewableDeployments } from './revio-deployment-links'

const CHIP =
  'right-sidebar-header-no-drag flex h-6 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'

/** "View deployment" in the PR bar: one live deployment, or a menu of several. */
export function RevioDeploymentButton({
  pr
}: {
  pr: Pick<PRInfo, 'headSha' | 'prRepo'>
}): React.JSX.Element | null {
  const repo = useAppStore((s) => {
    const worktree = s.activeWorktreeId
      ? findWorktreeById(selectWorktreesByRepo(s), s.activeWorktreeId)
      : undefined
    return worktree ? (s.repos.find((candidate) => candidate.id === worktree.repoId) ?? null) : null
  })
  const live = viewableDeployments(useDeployments(repo, pr))
  const label = translate('auto.components.revioLayout.viewDeployment', 'View deployment')
  const open = (url: string | null): void => {
    if (url) {
      void window.api.shell.openUrl(url)
    }
  }
  if (live.length === 0) {
    return null
  }
  if (live.length === 1) {
    return (
      <button
        type="button"
        className={CHIP}
        title={live[0]?.environment}
        onClick={() => open(live[0]?.url ?? null)}
      >
        <Rocket className="size-3" />
        {label}
      </button>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={CHIP}>
          <Rocket className="size-3" />
          {label}
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {live.map((deployment) => (
          <DropdownMenuItem key={deployment.id} onSelect={() => open(deployment.url)}>
            {deployment.environment}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
