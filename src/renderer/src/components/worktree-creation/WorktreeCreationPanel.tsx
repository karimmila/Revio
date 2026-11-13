import React from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { useAppStore } from '@/store'
import { retryBackgroundWorktreeCreation } from '@/lib/workspace/creation/worktree-creation-flow'
import {
  getCreationProgressLabel,
  getVisibleCheckoutProgress
} from '@/lib/workspace/creation/pending-worktree-creation'
import { Progress } from '@/components/ui/progress'
import { translate } from '@/i18n/i18n'
import { isCloudSetupCreation } from '@/lib/workspace/creation/cloud-setup-steps'
import WorktreeCreationTabStrip from './WorktreeCreationTabStrip'
import { CloudSetupCard } from './CloudSetupCard'
import { CloudSetupStatus } from './CloudSetupStatus'
import { formatElapsedTime, useWorktreeCreationClock } from './worktree-creation-clock'

/** Debounced in-frame creation placeholder: tab strip names the workspace while body shows status, enabling same-frame handoff without duplicating labels. */
export default function WorktreeCreationPanel({
  creationId,
  reserveCollapsedSidebarHeaderSpace = false
}: {
  creationId: string
  reserveCollapsedSidebarHeaderSpace?: boolean
}): React.JSX.Element | null {
  const entry = useAppStore((s) => s.pendingWorktreeCreations[creationId])
  const progressLabelId = React.useId()
  // Depend on primitive status so stderr’s fresh entry objects cannot continuously reset the interval.
  const now = useWorktreeCreationClock(entry?.status === 'creating')
  if (!entry) {
    return null
  }

  const dismiss = (): void => useAppStore.getState().removePendingWorktreeCreation(creationId)
  const isError = entry.status === 'error'
  // Cloud creations keep the card through pairing and failure, so a retry never swaps layouts.
  const isVmCreation = isCloudSetupCreation(entry)
  const title = entry.request.displayName || entry.request.name
  const elapsedLabel = formatElapsedTime(now - entry.startedAt)
  const checkoutProgress = getVisibleCheckoutProgress(entry)

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <WorktreeCreationTabStrip
        title={title}
        isError={isError}
        reserveCollapsedSidebarHeaderSpace={reserveCollapsedSidebarHeaderSpace}
        onCancel={dismiss}
      />

      <div className="min-h-0 flex-1 p-3">
        {entry.request.simpleCloudSetup ? (
          <div className="mx-auto w-full max-w-3xl px-4 pt-[12vh]">
            <CloudSetupStatus
              entry={entry}
              now={now}
              onRetry={() => retryBackgroundWorktreeCreation(creationId)}
              onDismiss={dismiss}
            />
          </div>
        ) : isVmCreation ? (
          <CloudSetupCard
            entry={entry}
            now={now}
            error={
              isError
                ? (entry.error ??
                  translate(
                    'auto.components.worktree.creation.WorktreeCreationPanel.767951265d',
                    'Something went wrong while creating the worktree.'
                  ))
                : null
            }
            onCancel={dismiss}
            onRetry={() => retryBackgroundWorktreeCreation(creationId)}
            onDismiss={dismiss}
          />
        ) : isError ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-medium text-destructive">
              {translate(
                'auto.components.worktree.creation.WorktreeCreationPanel.ed2a664f8b',
                'Couldn’t create worktree'
              )}
            </span>
            <span className="text-muted-foreground">
              {entry.error ??
                translate(
                  'auto.components.worktree.creation.WorktreeCreationPanel.767951265d',
                  'Something went wrong while creating the worktree.'
                )}
            </span>
            <button
              type="button"
              onClick={() => retryBackgroundWorktreeCreation(creationId)}
              className="inline-flex items-center gap-1 text-foreground hover:underline"
            >
              <RotateCcw className="size-3" />
              {translate(
                'auto.components.worktree.creation.WorktreeCreationPanel.34dd5ee38b',
                'Retry'
              )}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              {translate(
                'auto.components.worktree.creation.WorktreeCreationPanel.dabd226118',
                'Dismiss'
              )}
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 max-w-3xl flex-col gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
              <span id={progressLabelId} className="tabular-nums">
                {getCreationProgressLabel(entry)}
              </span>
              <span className="text-muted-foreground/70">{elapsedLabel}</span>
            </div>
            {checkoutProgress ? (
              <Progress
                value={checkoutProgress.percent}
                aria-labelledby={progressLabelId}
                className="h-1.5 max-w-xs"
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
