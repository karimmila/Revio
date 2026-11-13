import React from 'react'
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import {
  cleanCloudSetupLog,
  type CloudSetupEntry
} from '@/lib/workspace/creation/cloud-setup-steps'
import { CloudSetupLog } from './CloudSetupLog'
import { formatElapsedTime } from './worktree-creation-clock'

export function cloudSetupLoadingText(): string {
  return translate(
    'auto.components.worktree.creation.CloudSetupStatus.settingUp',
    'Setting up workspace…'
  )
}

/** The reason's first line only; the full text stays in the details log. */
function oneLineReason(error: string | null | undefined): string {
  const first = error
    ?.split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  return (
    first ??
    translate(
      'auto.components.worktree.creation.WorktreeCreationPanel.767951265d',
      'Something went wrong while creating the worktree.'
    )
  )
}

/** One loading line while a cloud workspace is set up, or one short error with Retry once it fails. */
export function CloudSetupStatus({
  entry,
  now,
  onRetry,
  onDismiss
}: {
  entry: CloudSetupEntry
  now: number
  onRetry: () => void
  onDismiss: () => void
}): React.JSX.Element {
  if (entry.status !== 'error') {
    return (
      <div
        role="status"
        data-cloud-setup-status="running"
        className="flex items-center gap-2 py-1 text-sm text-muted-foreground"
      >
        <Loader2 aria-hidden className="size-3.5 shrink-0 motion-safe:animate-spin" />
        <span>{cloudSetupLoadingText()}</span>
        <span className="text-xs tabular-nums text-muted-foreground/70">
          {formatElapsedTime(now - entry.startedAt)}
        </span>
      </div>
    )
  }
  const reason = oneLineReason(entry.error)
  return (
    <div role="alert" data-cloud-setup-status="failed" className="flex flex-col gap-2 py-1 text-sm">
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-destructive" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-foreground">
            {translate(
              'auto.components.worktree.creation.CloudSetupStatus.failed',
              'Couldn’t set up the workspace.'
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground" title={reason}>
            {reason}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 pl-5.5">
        <Button type="button" variant="outline" size="xs" onClick={onRetry}>
          <RotateCcw />
          {translate('auto.components.worktree.creation.WorktreeCreationPanel.34dd5ee38b', 'Retry')}
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={onDismiss}>
          {translate(
            'auto.components.worktree.creation.WorktreeCreationPanel.dabd226118',
            'Dismiss'
          )}
        </Button>
      </div>
      <div className="pl-5.5">
        <CloudSetupLog
          log={cleanCloudSetupLog(entry.provisioningLog ?? '')}
          defaultOpen={false}
          toggleLabels={{
            show: translate(
              'auto.components.worktree.creation.CloudSetupStatus.showDetails',
              'Show details'
            ),
            hide: translate(
              'auto.components.worktree.creation.CloudSetupStatus.hideDetails',
              'Hide details'
            )
          }}
        />
      </div>
    </div>
  )
}
