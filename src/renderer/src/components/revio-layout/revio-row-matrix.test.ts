import { describe, expect, it } from 'vitest'
import {
  revioMatrixSpec,
  MATRIX_DOTS,
  MATRIX_ERROR_DOTS,
  MATRIX_MERGED_CELLS
} from './revio-row-matrix'

const spec = (args: Partial<Parameters<typeof revioMatrixSpec>[0]>) =>
  revioMatrixSpec({ agent: null, prState: null, unread: false, ...args })

describe('revioMatrixSpec', () => {
  it('lays out a 4×4 grid, a 7×7 checkerboard and an X of eight dots', () => {
    expect(MATRIX_DOTS).toHaveLength(16)
    expect(MATRIX_DOTS[5]).toEqual({ index: 5, x: 5.5, y: 5.5 })
    expect(MATRIX_MERGED_CELLS).toHaveLength(25)
    expect([...MATRIX_ERROR_DOTS]).toEqual([0, 3, 5, 6, 9, 10, 12, 15])
  })

  it('shows merged as a purple checkerboard over full dots', () => {
    expect(spec({ prState: 'merged' })).toEqual({
      color: 'var(--revio-row-merged)',
      baseOpacity: 1,
      merged: true,
      overlay: null
    })
  })

  it('colours the full grid by PR state, with a merge conflict in amber', () => {
    expect(spec({ prState: 'ready-to-merge' }).color).toBe('var(--revio-row-ready)')
    expect(spec({ prState: 'merge-conflict' }).color).toBe('var(--revio-row-conflict-icon)')
    expect(spec({ prState: 'open-pr' })).toMatchObject({ baseOpacity: 1, overlay: null })
  })

  it('draws the red X on failing checks or a failed agent, over dimmed dots', () => {
    const failing = { baseOpacity: 0.32, merged: false, overlay: 'error' }
    expect(spec({ prState: 'checks-failing' })).toMatchObject(failing)
    expect(spec({ agent: 'failed', prState: 'merged' })).toMatchObject(failing)
  })

  it('lets agent states take the overlay, keeping the PR colour at half strength', () => {
    expect(spec({ agent: 'working', prState: 'open-pr' })).toMatchObject({
      baseOpacity: 0.5,
      overlay: 'working'
    })
    expect(spec({ agent: 'needs-user-permission', prState: 'checks-failing' }).overlay).toBe(
      'attention'
    )
    expect(spec({ agent: 'waiting' }).overlay).toBe('waiting')
    expect(spec({ agent: 'setting-up' }).overlay).toBe('setup')
    expect(spec({ prState: 'checks-pending' })).toMatchObject({
      baseOpacity: 0.5,
      overlay: 'checks'
    })
  })

  it('dims a workspace without a PR unless it is unread', () => {
    expect(spec({})).toMatchObject({ color: 'var(--revio-row-muted)', baseOpacity: 0.32 })
    expect(spec({ unread: true })).toMatchObject({ color: 'var(--foreground)', baseOpacity: 1 })
  })
})
