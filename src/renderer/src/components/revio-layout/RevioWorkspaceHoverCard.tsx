import type React from 'react'
import {
  Archive,
  ArrowUpRight,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft
} from 'lucide-react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { useAppStore } from '@/store'
import type { AppState } from '@/store'
import { translate } from '@/i18n/i18n'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import type { WorktreeCardPrDisplay } from '@/components/sidebar/workspace-card/review/worktree-card-pr-display'
import { runWorktreeDelete } from '@/components/sidebar/workspace-actions/deletion/delete-worktree-flow'
import { RevioLineTotal } from './revio-layout'
import { openRevioPullRequest } from './open-revio-pull-request'
import { formatRevioAgo, formatRevioAgoPhrase } from './revio-ago'

export { formatRevioAgo }

/** The newest assistant message any agent in this workspace reported, for the preview line. */
export function selectLatestAgentMessage(
  state: Pick<AppState, 'agentStatusByPaneKey' | 'tabsByWorktree'>,
  worktreeId: string
): string | null {
  const tabIds = new Set((state.tabsByWorktree?.[worktreeId] ?? []).map((tab) => tab.id))
  let latest: string | null = null
  let latestAt = 0
  for (const entry of Object.values(state.agentStatusByPaneKey ?? {})) {
    const tabId = entry.tabId ?? entry.paneKey.split(':')[0]
    if (entry.worktreeId !== worktreeId && !tabIds.has(tabId)) {
      continue
    }
    const message = (entry.lastAssistantMessage ?? entry.lastCompletedAssistantMessage)?.trim()
    if (message && entry.updatedAt > latestAt) {
      latest = message
      latestAt = entry.updatedAt
    }
  }
  return latest
}

function PrStateIcon({ pr }: { pr: WorktreeCardPrDisplay }): React.JSX.Element {
  if (pr.state === 'merged') {
    return <GitMerge className="size-3.5" />
  }
  if (pr.state === 'closed') {
    return <GitPullRequestClosed className="size-3.5" />
  }
  if (pr.state === 'draft') {
    return <GitPullRequestDraft className="size-3.5" />
  }
  return <GitPullRequest className="size-3.5" />
}

function HoverCardBody({
  worktree,
  repo,
  pr
}: {
  worktree: Worktree
  repo: Repo | null | undefined
  pr: WorktreeCardPrDisplay | null
}): React.JSX.Element {
  const message = useAppStore((s) => selectLatestAgentMessage(s, worktree.id))
  const branch = worktree.branch.replace(/^refs\/heads\//, '')
  const preview = message ?? (worktree.comment.trim() || null)
  const url = pr?.url
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-2 text-[11.5px]">
        <span className="min-w-0 truncate font-mono text-muted-foreground">{branch}</span>
        <RevioLineTotal worktreeId={worktree.id} className="text-[11.5px]" />
        {repo ? (
          <span className="ml-auto flex shrink-0 items-center gap-1.5 text-muted-foreground">
            <RepoIconGlyph repoIcon={repo.repoIcon} className="size-4" iconClassName="size-3.5" />
            <span className="max-w-32 truncate text-[12px]">{repo.displayName}</span>
          </span>
        ) : null}
      </div>
      <div className="truncate text-[13.5px] text-foreground">{worktree.displayName || branch}</div>
      {preview ? <div className="truncate text-[12px] text-muted-foreground">{preview}</div> : null}
      <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
        {pr?.state === 'merged' && !worktree.isMainWorktree ? (
          <button
            type="button"
            onClick={() => runWorktreeDelete(worktree.id)}
            className="flex h-[22px] items-center gap-1 rounded-[5px] bg-[var(--revio-pr-merged-strong)] px-1.5 text-[12px] font-medium text-[color:var(--revio-pr-merged-foreground)] transition-opacity hover:opacity-90"
          >
            <Archive className="size-3.5" />
            {translate('auto.components.revioLayout.archive', 'Archive')}
          </button>
        ) : null}
        {pr ? (
          <button
            type="button"
            disabled={!url}
            onClick={() => {
              if (url) {
                openRevioPullRequest(url)
              }
            }}
            aria-label={translate(
              'auto.components.revioLayout.openPullRequest',
              'Open pull request #{{value0}} on GitHub',
              { value0: pr.number }
            )}
            className="flex items-center gap-1 rounded-sm transition-colors hover:text-foreground"
          >
            <PrStateIcon pr={pr} />#{pr.number}
            <ArrowUpRight className="size-3" />
          </button>
        ) : null}
        <span className="ml-auto">{formatRevioAgoPhrase(worktree.lastActivityAt)}</span>
      </div>
    </div>
  )
}

/** The workspace preview: branch, diff, repo, title, latest reply and its pull request. */
export function RevioWorkspaceHoverCard({
  worktree,
  repo,
  pr,
  disabled,
  children
}: {
  worktree: Worktree
  repo: Repo | null | undefined
  pr: WorktreeCardPrDisplay | null
  disabled?: boolean
  children: React.ReactElement
}): React.JSX.Element {
  if (disabled) {
    return children
  }
  return (
    <HoverCard openDelay={600} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="right" align="start" sideOffset={10} variant="workspace-preview">
        <HoverCardBody worktree={worktree} repo={repo} pr={pr} />
      </HoverCardContent>
    </HoverCard>
  )
}
