import type React from 'react'
import { translate } from '@/i18n/i18n'
import { revioRowPrLabel, type RevioRowAgentIcon, type RevioRowPrState } from './revio-row-pr-state'
import {
  revioMatrixSpec,
  MATRIX_DOT,
  MATRIX_DOTS,
  MATRIX_ERROR_DOTS,
  MATRIX_MERGED_CELLS,
  MATRIX_SETUP_DOTS,
  MATRIX_WAITING_DOTS,
  type MatrixOverlay
} from './revio-row-matrix'

function agentIconLabel(icon: RevioRowAgentIcon): string {
  switch (icon) {
    case 'setting-up':
      return translate('auto.components.revioLayout.rowSettingUp', 'Setting up…')
    case 'failed':
      return translate('auto.components.revioLayout.rowFailed', 'Failed')
    case 'needs-plan-response':
      return translate('auto.components.revioLayout.rowReviewPlan', 'Review plan')
    case 'needs-user-permission':
      return translate('auto.components.revioLayout.rowNeedPermission', 'Need permission')
    case 'needs-user-input':
      return translate('auto.components.revioLayout.rowAnswerQuestion', 'Answer question')
    case 'working':
      return translate('auto.components.revioLayout.rowWorking', 'Working…')
    case 'waiting':
      return translate(
        'auto.components.revioLayout.rowBackgroundTasks',
        'Waiting for background tasks'
      )
  }
}

/** The matrix label: the agent state, then the PR state (or "Ready"), then "Unread". */
function matrixLabel(
  agent: RevioRowAgentIcon | null,
  prState: RevioRowPrState | null,
  unread: boolean
): string {
  const parts = [
    ...(agent ? [agentIconLabel(agent)] : []),
    ...(prState || !agent ? [revioRowPrLabel(prState)] : []),
    ...(unread ? [translate('auto.components.revioLayout.rowUnread', 'Unread')] : [])
  ]
  return parts.join('; ')
}

/** Which base dots an agent overlay lights; the others stay at the base. */
function overlayLit(overlay: MatrixOverlay, index: number): boolean {
  if (overlay === 'waiting') {
    return MATRIX_WAITING_DOTS.has(index)
  }
  if (overlay === 'setup') {
    return MATRIX_SETUP_DOTS.has(index)
  }
  return overlay === 'error' ? MATRIX_ERROR_DOTS.has(index) : true
}

/**
 * The sidebar row mark with "Workspace status matrix" on: pattern and colour carry the
 * PR state, agent state and unread. The workspace layout draws no left stripe in this style.
 */
export function RevioStatusGlyph({
  prState,
  agentIcon,
  unread = false
}: {
  prState: RevioRowPrState | null
  agentIcon: RevioRowAgentIcon | null
  unread?: boolean
}): React.JSX.Element {
  const spec = revioMatrixSpec({ agent: agentIcon, prState, unread })
  const overlay = spec.overlay
  return (
    <svg
      role="img"
      aria-label={matrixLabel(agentIcon, prState, unread)}
      viewBox="0 0 16 16"
      className="size-4 shrink-0"
      data-revio-row-matrix={overlay ?? (spec.merged ? 'merged' : 'steady')}
      style={{ color: spec.color }}
    >
      <g fill="currentColor" opacity={spec.baseOpacity}>
        {MATRIX_DOTS.map((dot) => (
          <rect key={dot.index} x={dot.x} y={dot.y} width={MATRIX_DOT} height={MATRIX_DOT} />
        ))}
      </g>
      {spec.merged ? (
        <g fill="currentColor">
          {MATRIX_MERGED_CELLS.map((cell) => (
            <rect key={cell.index} x={cell.x} y={cell.y} width={MATRIX_DOT} height={MATRIX_DOT} />
          ))}
        </g>
      ) : null}
      {overlay ? (
        <g
          data-revio-matrix-overlay={overlay}
          fill={overlay === 'error' ? 'var(--revio-row-failing)' : 'var(--foreground)'}
        >
          {MATRIX_DOTS.filter((dot) => overlayLit(overlay, dot.index)).map((dot) => (
            <rect
              key={dot.index}
              x={dot.x}
              y={dot.y}
              width={MATRIX_DOT}
              height={MATRIX_DOT}
              style={{ animationDelay: `${((dot.index * 47 + 13) % 97) * -12}ms` }}
            />
          ))}
        </g>
      ) : null}
    </svg>
  )
}
