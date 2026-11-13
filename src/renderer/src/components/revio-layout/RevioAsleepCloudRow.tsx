import type React from 'react'
import { translate } from '@/i18n/i18n'
import { wakeAsleepCloudWorkspace } from '@/lib/asleep-cloud-wake'
import type { AsleepCloudWorkspace } from '../../../../shared/asleep-cloud-workspace-types'
import { RevioStatusGlyph } from './RevioStatusGlyph'
import { RevioCloudMark } from './RevioCloudRowMark'
import { formatRevioAgo } from './RevioWorkspaceHoverCard'

/**
 * An imported cloud workspace with no sandbox yet, drawn like an asleep cloud workspace's row.
 * Opening it wakes it: the creation's "Setting up…" row takes its place until it is ready.
 */
export function RevioAsleepCloudRow({
  record
}: {
  record: AsleepCloudWorkspace
}): React.JSX.Element {
  const lastActivity = record.lastActivityAt ? Date.parse(record.lastActivityAt) : Number.NaN
  return (
    <button
      type="button"
      data-revio-asleep-cloud={record.id}
      title={translate('auto.components.revioLayout.asleepCloudOpen', 'Open to wake it')}
      onClick={() => void wakeAsleepCloudWorkspace(record)}
      className="worktree-sidebar-card-hover ml-2 flex w-[calc(100%-0.5rem)] cursor-pointer items-center rounded-lg border border-transparent pt-1.25 pr-1.5 pb-1 pl-0.5 text-left outline-none select-none"
    >
      <span className="flex h-[22px] min-w-0 flex-1 items-center gap-2">
        <RevioStatusGlyph prState={null} agentIcon={null} />
        <span className="min-w-0 flex-1 truncate text-[13px] leading-5">{record.displayName}</span>
        <RevioCloudMark asleep />
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {Number.isFinite(lastActivity) ? formatRevioAgo(lastActivity) : null}
        </span>
      </span>
    </button>
  )
}
