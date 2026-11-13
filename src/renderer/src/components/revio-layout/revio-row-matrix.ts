import { revioRowPrColor, type RevioRowAgentIcon, type RevioRowPrState } from './revio-row-pr-state'

/**
 * The workspace status matrix: a 4×4 grid of 1.5px dots in a 16px box. The dots take the
 * pull request's colour; patterns drawn over them carry the rest (a 7×7 checkerboard when
 * merged, a red X on failure, a blinking grid while the agent needs the person, moving dots
 * while it works or checks run). Unread workspaces without a PR show their dots at full strength.
 */
export const MATRIX_ORIGIN = 2.5
export const MATRIX_DOT = 1.5
const MATRIX_STEP = MATRIX_DOT * 2

export type MatrixOverlay = 'error' | 'attention' | 'working' | 'waiting' | 'setup' | 'checks'

export type MatrixSpec = {
  /** CSS colour of the base dots (and the merged pattern). */
  color: string
  baseOpacity: number
  /** The checkerboard over the dots; it shows under any agent overlay too. */
  merged: boolean
  overlay: MatrixOverlay | null
}

const ACTIVE = new Set<RevioRowAgentIcon>(['setting-up', 'working', 'waiting'])
const ATTENTION = new Set<RevioRowAgentIcon>([
  'failed',
  'needs-plan-response',
  'needs-user-input',
  'needs-user-permission'
])

/** The matrix colours: its row colour per PR state, amber for a merge conflict. */
function matrixColor(prState: RevioRowPrState): string {
  return prState === 'merge-conflict' ? 'var(--revio-row-conflict-icon)' : revioRowPrColor(prState)
}

export function revioMatrixSpec({
  agent,
  prState,
  unread
}: {
  agent: RevioRowAgentIcon | null
  prState: RevioRowPrState | null
  unread: boolean
}): MatrixSpec {
  const active = agent !== null && ACTIVE.has(agent)
  const attention = agent !== null && ATTENTION.has(agent)
  const failed = agent === 'failed' || (!active && !attention && prState === 'checks-failing')
  if (failed) {
    return {
      color: 'var(--revio-row-failing)',
      baseOpacity: 0.32,
      merged: false,
      overlay: 'error'
    }
  }
  const checksRunning = prState === 'checks-pending'
  const busy = attention || active || checksRunning
  const color = prState
    ? matrixColor(prState)
    : unread && !busy
      ? 'var(--foreground)'
      : 'var(--revio-row-muted)'
  const baseOpacity = busy && prState ? 0.5 : prState || (!active && unread) ? 1 : 0.32
  const overlay: MatrixOverlay | null = attention
    ? 'attention'
    : agent === 'working'
      ? 'working'
      : agent === 'waiting'
        ? 'waiting'
        : agent === 'setting-up'
          ? 'setup'
          : checksRunning
            ? 'checks'
            : null
  return { color, baseOpacity, merged: prState === 'merged', overlay }
}

export type MatrixDot = { index: number; x: number; y: number }

/** The 16 base dots, row by row. */
export const MATRIX_DOTS: MatrixDot[] = Array.from({ length: 16 }, (_, index) => ({
  index,
  x: MATRIX_ORIGIN + (index % 4) * MATRIX_STEP,
  y: MATRIX_ORIGIN + Math.floor(index / 4) * MATRIX_STEP
}))

/** The failure X: the corners and the four centre dots. */
export const MATRIX_ERROR_DOTS = new Set([0, 3, 5, 6, 9, 10, 12, 15])
/** Lit while waiting on background tasks (the second row) and while setting up (the corners). */
export const MATRIX_WAITING_DOTS = new Set([4, 5, 6, 7])
export const MATRIX_SETUP_DOTS = new Set([0, 3, 12, 15])

/** The merged checkerboard: every other cell of a 7×7 grid of 1.5px cells. */
export const MATRIX_MERGED_CELLS: MatrixDot[] = Array.from({ length: 49 }, (_, index) => ({
  index,
  x: MATRIX_ORIGIN + (index % 7) * MATRIX_DOT,
  y: MATRIX_ORIGIN + Math.floor(index / 7) * MATRIX_DOT
})).filter(({ index }) => ((index % 7) + Math.floor(index / 7)) % 2 === 0)
