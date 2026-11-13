import type React from 'react'
import { Archive, CloudDownload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { WorktreeTitleInlineRename } from '@/components/sidebar/workspace-card/identity/WorktreeTitleInlineRename'
import { shouldBeginWorktreeRename } from '@/components/sidebar/workspace-card/controller/worktree-card-model'
import type { WorktreeCardController } from '@/components/sidebar/workspace-card/controller/use-worktree-card-controller'
import { runWorktreeDelete } from '@/components/sidebar/workspace-actions/deletion/delete-worktree-flow'
import { isCloudMirrorPath, isCloudRepo, useCloudEnvironmentIds } from '@/lib/cloud-workspaces'
import { RevioStatusGlyph } from './RevioStatusGlyph'
import { RevioCloudRowMark } from './RevioCloudRowMark'
import { revioRowAgentIcon, revioRowPrState } from './revio-row-pr-state'
import { RevioWorkspaceHoverCard, formatRevioAgo } from './RevioWorkspaceHoverCard'
import { RevioLineTotal } from './revio-layout'
import { RevioOpenDraftButton } from './RevioOpenDraftButton'
import { useWorktreeActivityStatus } from '@/components/sidebar/workspace-card/activity/use-worktree-activity-status'
import type { WorktreeStatus } from '../../../../shared/worktree-status-rollup'
import { useRevioChatPhase, type RevioChatPhase } from './use-revio-chat-phase'
import { useSetupStatus } from './revio-setup-status'
import { useRevioRowStatus } from './revio-stale-failure'
import { useRevioRowNeedsSignIn } from './revio-needs-sign-in'
import type { SetupStatus } from '../../../../shared/setup-status'

/** The row words for an agent at work; other states show the age. */
export function agentStateLabel(
  status: WorktreeStatus,
  phase: RevioChatPhase | null,
  deleting: boolean,
  setup: SetupStatus | null
): string | null {
  if (deleting) {
    return translate('auto.components.revioLayout.rowArchiving', 'Archiving…')
  }
  if (setup === 'running') {
    return translate('auto.components.revioLayout.rowSettingUp', 'Setting up…')
  }
  if (phase === 'question') {
    return translate('auto.components.revioLayout.rowAnswerQuestion', 'Answer question')
  }
  if (phase === 'plan') {
    return translate('auto.components.revioLayout.rowReviewPlan', 'Review plan')
  }
  if (phase === 'planning' && status === 'working') {
    return translate('auto.components.revioLayout.rowPlanning', 'Planning…')
  }
  if (status === 'working') {
    return translate('auto.components.revioLayout.rowWorking', 'Working…')
  }
  if (status === 'monitoring') {
    // The agent's turn ended but its background tasks still run.
    return translate(
      'auto.components.revioLayout.rowBackgroundTasks',
      'Waiting for background tasks'
    )
  }
  if (status === 'permission') {
    return translate('auto.components.revioLayout.rowNeedPermission', 'Need permission')
  }
  if (status === 'failed') {
    return translate('auto.components.revioLayout.rowFailed', 'Failed')
  }
  if (setup === 'failed') {
    return translate('auto.components.revioLayout.rowSetupFailed', 'Initialization failed')
  }
  return null
}

/**
 * The one-line workspace row: PR status mark, title, then the workspace's age (since it was
 * created; last activity for worktrees Orca discovered), which an archive button replaces on
 * hover. The diff total sits before it, and an agent at work shows its state in place of the age.
 */
export function RevioWorkspaceRow({ card }: { card: WorktreeCardController }): React.JSX.Element {
  const { worktree, repo, affiliateListMode } = card
  const optionalChecksBlocking = useAppStore(
    (s) => s.settings?.revioOptionalChecksBlocking === true
  )
  const prState = revioRowPrState(card.prDisplay, optionalChecksBlocking)
  const cloudEnvironmentIds = useCloudEnvironmentIds()
  const cloud = repo ? isCloudRepo(repo, cloudEnvironmentIds) : false
  const rowStatus = useRevioRowStatus(worktree.id, useWorktreeActivityStatus(worktree.id))
  // A chat that could not start for want of a Claude login is not a failed workspace.
  const needsSignIn = useRevioRowNeedsSignIn(worktree.id, rowStatus)
  const activity = needsSignIn ? 'inactive' : rowStatus
  const phase = useRevioChatPhase(worktree.id)
  const setup = useSetupStatus(worktree.path)
  const agentState =
    agentStateLabel(activity, phase, card.isDeleting, setup) ??
    (needsSignIn ? translate('auto.components.revioLayout.rowNeedsSignIn', 'Needs sign-in') : null)
  const agentIcon = revioRowAgentIcon({ setup, status: activity, phase })
  // A cloud workspace is its sandbox's checkout root; archiving it removes the project and the VM.
  const canArchive =
    (!worktree.isMainWorktree ||
      worktree.ephemeralVmCheckoutMode === 'provisioned-root' ||
      cloud) &&
    !card.isDeleting &&
    !affiliateListMode
  return (
    <RevioWorkspaceHoverCard
      worktree={worktree}
      repo={repo}
      pr={card.prDisplay}
      disabled={card.titleRenaming || affiliateListMode}
    >
      <div
        data-worktree-card-parent-content=""
        data-revio-pinned={card.inPinnedSection ? '' : undefined}
        className="group/revio-row flex h-[22px] min-w-0 items-center gap-2"
      >
        <RevioStatusGlyph
          prState={prState}
          agentIcon={agentIcon}
          unread={card.showUnreadEmphasis}
        />
        <div className="flex min-w-0 flex-1 items-center">
          <WorktreeTitleInlineRename
            displayName={card.visibleCardTitle}
            disabled={card.isDeleting || affiliateListMode}
            showUnreadEmphasis={card.showUnreadEmphasis}
            dimReadTitle={false}
            className="text-[13px] leading-5"
            editingClassName="flex-1"
            titleWrapper={(title) => title}
            onEditingChange={affiliateListMode ? undefined : card.setTitleRenaming}
            onRename={card.handleRenameTitle}
            beginEditing={
              !affiliateListMode &&
              shouldBeginWorktreeRename(card.renamingWorktreeId, worktree.id, card.renameRowKey)
            }
            onBeginEditingConsumed={
              affiliateListMode ? undefined : () => card.setRenamingWorktreeId(null)
            }
          />
        </div>
        {isCloudMirrorPath(worktree.path) ? (
          <span
            data-revio-mirror-label=""
            className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground"
          >
            <CloudDownload className="size-3" />
            {translate('auto.components.revioLayout.mirrorLabel', 'mirror')}
          </span>
        ) : null}
        {cloud ? <RevioCloudRowMark repo={repo} active={card.isActive} /> : null}
        <RevioOpenDraftButton worktreeId={worktree.id} />
        <RevioLineTotal worktreeId={worktree.id} className="text-[10.5px]" sidebarRow />
        <span
          data-revio-row-state={agentState ? '' : undefined}
          className={cn(
            'shrink-0 text-[11px] tabular-nums text-muted-foreground',
            canArchive && 'group-hover/revio-row:hidden'
          )}
        >
          {/* Worktrees made outside Orca (a cloud mirror) carry no time at all, not "epoch 0". */}
          {agentState ??
            ((worktree.createdAt ?? worktree.lastActivityAt)
              ? formatRevioAgo(worktree.createdAt ?? worktree.lastActivityAt)
              : null)}
        </span>
        {canArchive ? (
          <button
            type="button"
            aria-label={translate(
              'auto.components.revioLayout.archiveWorkspace',
              'Archive workspace'
            )}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              // A cloud workspace archives with a restore point there, never as a project removal.
              runWorktreeDelete(
                worktree.id,
                worktree.hostId ? { expectedHostId: worktree.hostId } : {}
              )
            }}
            className="hidden size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors group-hover/revio-row:flex hover:bg-accent hover:text-foreground"
          >
            <Archive className="size-3.5" />
          </button>
        ) : null}
      </div>
    </RevioWorkspaceHoverCard>
  )
}
