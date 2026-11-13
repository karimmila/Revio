import type React from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { useWorktreeActivityStatus } from '@/components/sidebar/workspace-card/activity/use-worktree-activity-status'
import type { WorktreeStatus } from '../../../../shared/worktree-status-rollup'

export type MatrixTone = 'working' | 'attention' | 'failed' | 'done' | 'idle'

/** The local state the experimental matrix shows for a workspace without a pull request. */
export function matrixTone(status: WorktreeStatus): MatrixTone {
  switch (status) {
    case 'working':
    case 'monitoring':
      return 'working'
    case 'permission':
    case 'unconfirmed':
      return 'attention'
    case 'failed':
    case 'interrupted':
      return 'failed'
    case 'done':
      return 'done'
    case 'active':
    case 'inactive':
      return 'idle'
  }
}

function toneLabel(tone: MatrixTone): string {
  switch (tone) {
    case 'working':
      return translate('auto.components.revioLayout.matrixWorking', 'Agent working')
    case 'attention':
      return translate('auto.components.revioLayout.matrixAttention', 'Needs attention')
    case 'failed':
      return translate('auto.components.revioLayout.matrixFailed', 'Agent failed')
    case 'done':
      return translate('auto.components.revioLayout.matrixDone', 'Agent finished')
    case 'idle':
      return translate('auto.components.revioLayout.matrixIdle', 'Idle')
  }
}

const GRID = [0, 1, 2, 3]

/**
 * The experimental status matrix: the 4×4 dot mark lit by the workspace's local agent
 * state (working cells pulse) when there is no pull request to show.
 */
export function RevioStatusMatrix({ status }: { status: WorktreeStatus }): React.JSX.Element {
  const tone = matrixTone(status)
  return (
    <svg
      role="img"
      aria-label={toneLabel(tone)}
      viewBox="0 0 14 14"
      className="size-3.5 shrink-0"
      data-revio-status-matrix={tone}
    >
      {GRID.flatMap((row) =>
        GRID.map((col) => (
          <rect
            key={`${row}:${col}`}
            x={col * 4}
            y={row * 4}
            width={2}
            height={2}
            style={{ animationDelay: `${(row + col) * 90}ms` }}
          />
        ))
      )}
    </svg>
  )
}

/** Home's leading mark: the matrix while the experimental setting is on, else a blank slot. */
export function RevioHomeStatusMark({ worktreeId }: { worktreeId: string }): React.JSX.Element {
  const enabled = useAppStore((s) => s.settings?.revioStatusMatrix === true)
  const status = useWorktreeActivityStatus(worktreeId)
  return enabled ? (
    <RevioStatusMatrix status={status} />
  ) : (
    <span className="w-3.5 shrink-0" aria-hidden="true" />
  )
}
