import { revioPromptsForWorktree } from './revio-prompts-for-worktree'
import type React from 'react'
import { Archive, ArrowUpRight, GitCommitHorizontal, GitMerge, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { cloudEnvironmentIdsNow, isCloudRepo } from '@/lib/cloud-workspaces'
import { translate } from '@/i18n/i18n'
import { runWorktreeDelete } from '@/components/sidebar/workspace-actions/deletion/delete-worktree-flow'
import { revioAutoMergeMode, describePullRequest, type PrLike } from './revio-pr-status'
import { RevioCreatePrButton } from './RevioCreatePrButton'
import { RevioAutoMergeButton, RevioMergeButton, RevioMergeStackButton } from './RevioMergeButton'
import { commitAndPushWithAgent } from './revio-git-actions'
import { useRevioGitKeys } from './use-revio-git-keys'
import { useArchiveOnMerge } from './use-archive-on-merge'
import { RevioContinueButton } from './RevioContinueButton'
import { launchRevioAgentChat } from './launch-revio-chat'
import { revioPrompt, type RevioPromptId } from './revio-prompts'
import { openRevioPullRequest } from './open-revio-pull-request'
import { RevioStackChip } from './RevioStackChip'
import { RevioReadyForReviewButton } from './RevioReadyForReviewButton'
import { RevioDeploymentButton } from './RevioDeploymentButton'
import { RevioApproveButton, RevioRequestReviewButton } from './RevioReviewActions'
import {
  useRevioStack,
  useGitHubPullRequestStack,
  usePullRequestForActiveWorkspace,
  useSelectedStackEntry
} from './use-revio-pull-request'

function ActionButton({
  worktreeId,
  id,
  subject,
  icon,
  label
}: {
  worktreeId: string
  id: RevioPromptId
  subject: string
  icon: React.ReactNode
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() =>
        launchRevioAgentChat(worktreeId, {
          prompt: subject + revioPrompt(revioPromptsForWorktree(worktreeId), id)
        })
      }
      data-revio-pr-action=""
      className="right-sidebar-header-no-drag ml-auto flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium"
    >
      {icon}
      {label}
    </button>
  )
}

/**
 * The right-column top row. With a PR: the stack chip when the PR is part of a stack, a
 * `#N ↗` chip that opens it, and its state, tinted purple once merged (with Archive) and warm while
 * open, plus Resolve or Fix when the PR needs one. Without one: Create PR.
 */
export function RevioPrBar(): React.JSX.Element {
  const own = usePullRequestForActiveWorkspace()
  const stack = useRevioStack()
  const stackEntry = useSelectedStackEntry(stack)
  const worktreeId = useAppStore((s) => s.activeWorktreeId)
  const isCloudWorkspace = useAppStore((s) => {
    const repo = s.repos.find((entry) => s.activeWorktreeId?.startsWith(`${entry.id}::`))
    return repo ? isCloudRepo(repo, cloudEnvironmentIdsNow()) : false
  })
  const uncommitted = useAppStore((s) =>
    s.activeWorktreeId ? (s.gitStatusByWorktree?.[s.activeWorktreeId]?.length ?? 0) : 0
  )
  const pr: PrLike | null = stackEntry
    ? { ...stackEntry, checks: stackEntry.checksStatus }
    : own
      ? {
          ...own,
          checks: 'checksStatus' in own ? own.checksStatus : own.status,
          mergeStateStatus: 'mergeStateStatus' in own ? own.mergeStateStatus : null
        }
      : null
  const optionalChecksBlocking = useAppStore(
    (s) => s.settings?.revioOptionalChecksBlocking === true
  )
  const githubStack = useGitHubPullRequestStack()
  const status = pr
    ? describePullRequest(pr, stackEntry ? 0 : uncommitted, optionalChecksBlocking)
    : null
  // A stack PR other than the workspace's own: its fixes name it, and archiving stays with the top.
  const otherStackPr = stackEntry && stackEntry.number !== stack?.ownNumber ? stackEntry : null
  const subject = otherStackPr
    ? `Work on pull request #${otherStackPr.number}${otherStackPr.headRefName ? ` (branch ${otherStackPr.headRefName})` : ''}, part of this stack. `
    : ''
  // Merging a stack PR needs Orca's stack confirmation; that stays in the PR page.
  const mergeable = status?.action === 'merge' && own && !stack ? own : null
  // The workspace's own PR on top merges the stack below it.
  const stackMergeable =
    status?.action === 'merge' && own && stack && githubStack && !otherStackPr ? own : null
  const autoMergeSetting = useAppStore((s) => s.settings?.revioAutoMerge === true)
  const autoMergeMode =
    own && !otherStackPr
      ? revioAutoMergeMode({
          enabledInSettings: autoMergeSetting,
          checksPending: status?.checksPending === true,
          autoMergeEnabled: own.autoMergeEnabled,
          autoMergeAllowed: own.autoMergeAllowed,
          stacked: stack !== null,
          provider: 'provider' in own ? own.provider : 'github'
        })
      : null
  const githubOwnOpen =
    own !== null &&
    !otherStackPr &&
    pr?.state === 'open' &&
    (!('provider' in own) || own.provider === 'github')
  useRevioGitKeys({ worktreeId, pr, status: status?.action ?? null, mergeable, subject })
  useArchiveOnMerge({
    worktreeId,
    prNumber: own && !otherStackPr ? own.number : null,
    merged: !otherStackPr && status?.tone === 'merged',
    cloud: isCloudWorkspace,
    stackHasOpenPrs: (stack?.entries ?? []).some((entry) => entry.state === 'open')
  })
  return (
    <div
      data-revio-pr-tone={status?.tone}
      className={cn(
        'right-sidebar-header-drag flex h-9 min-h-9 shrink-0 items-center gap-2 border-b border-border px-2.5 text-[13px]',
        status?.tone === 'merged' && 'bg-[var(--revio-pr-merged-surface)]',
        status?.tone === 'open' && 'bg-[var(--revio-pr-open-surface)]',
        status?.tone === 'attention' && 'bg-[var(--revio-pr-attention-surface)]',
        status?.tone === 'ready' && 'bg-[var(--revio-pr-ready-surface)]'
      )}
    >
      {pr && status ? (
        <>
          {stack && stackEntry ? <RevioStackChip stack={stack} selected={stackEntry} /> : null}
          <button
            type="button"
            onClick={() => openRevioPullRequest(pr.url)}
            aria-label={translate(
              'auto.components.revioLayout.openPullRequestAnywhere',
              'Open pull request #{{value0}}',
              { value0: pr.number }
            )}
            className="right-sidebar-header-no-drag flex h-6 shrink-0 items-center overflow-hidden rounded-md border border-[var(--revio-pr-chip-border)] text-[var(--revio-pr-chip-text)] transition-colors hover:bg-foreground/5"
          >
            <span className="px-2 tabular-nums">#{pr.number}</span>
            <span className="flex h-full items-center border-l border-[var(--revio-pr-chip-border)] px-1.5">
              <ArrowUpRight className="size-3.5" />
            </span>
          </button>
          <span
            title={pr.title}
            className={cn(
              'min-w-0 truncate',
              status.tone === 'merged' ? 'text-[var(--revio-pr-merged-text)]' : 'text-foreground'
            )}
          >
            {status.label}
          </span>
          {status.tone === 'merged' && worktreeId && !otherStackPr && !isCloudWorkspace ? (
            <RevioContinueButton worktreeId={worktreeId} />
          ) : null}
          {status.tone === 'merged' && worktreeId && !otherStackPr ? (
            <button
              type="button"
              onClick={() => runWorktreeDelete(worktreeId)}
              className={cn(
                'right-sidebar-header-no-drag flex h-6 shrink-0 items-center gap-1.5 rounded-md bg-[var(--revio-pr-merged-strong)] px-2 text-[12.5px] font-medium text-[color:var(--revio-pr-merged-foreground)] transition-opacity hover:opacity-90',
                isCloudWorkspace && 'ml-auto'
              )}
            >
              <Archive className="size-3.5" />
              {translate('auto.components.revioLayout.archive', 'Archive')}
            </button>
          ) : null}
          {status.action === 'resolveConflicts' && worktreeId ? (
            <ActionButton
              worktreeId={worktreeId}
              id="resolveConflicts"
              subject={subject}
              icon={<GitMerge className="size-3.5" />}
              label={translate('auto.components.revioLayout.resolve', 'Resolve')}
            />
          ) : null}
          {status.action === 'commitAndPush' && worktreeId ? (
            <button
              type="button"
              onClick={() => commitAndPushWithAgent(worktreeId)}
              data-revio-pr-action=""
              className="right-sidebar-header-no-drag ml-auto flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium"
            >
              <GitCommitHorizontal className="size-3.5" />
              {translate('auto.components.revioLayout.git.commitAndPush', 'Commit and push')}
            </button>
          ) : null}
          {mergeable ? <RevioMergeButton pr={mergeable} /> : null}
          {pr.state === 'draft' &&
          own &&
          !otherStackPr &&
          (!('provider' in own) || own.provider === 'github') ? (
            <RevioReadyForReviewButton prNumber={own.number} />
          ) : null}
          {own && !otherStackPr && pr.state !== 'merged' && pr.state !== 'closed' ? (
            <RevioDeploymentButton
              pr={{
                headSha: own.headSha,
                prRepo: 'provider' in own ? own.githubRepository : own.prRepo
              }}
            />
          ) : null}
          {githubOwnOpen && own ? <RevioRequestReviewButton prNumber={own.number} /> : null}
          {githubOwnOpen && own && pr.reviewDecision === 'REVIEW_REQUIRED' ? (
            <RevioApproveButton prNumber={own.number} />
          ) : null}
          {own && autoMergeMode ? <RevioAutoMergeButton pr={own} mode={autoMergeMode} /> : null}
          {stackMergeable && githubStack ? (
            <RevioMergeStackButton pr={stackMergeable} stack={githubStack} />
          ) : null}
          {status.action === 'fixErrors' && worktreeId ? (
            <ActionButton
              worktreeId={worktreeId}
              id="fixErrors"
              subject={subject}
              icon={<Wrench className="size-3.5" />}
              label={translate('auto.components.revioLayout.fix', 'Fix')}
            />
          ) : null}
        </>
      ) : (
        <RevioCreatePrButton worktreeId={worktreeId} />
      )}
    </div>
  )
}
