import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: () => false }))
vi.mock('@/components/sidebar/workspace-card/activity/use-worktree-activity-status', () => ({
  useWorktreeActivityStatus: () => 'inactive'
}))

import { matrixTone } from './RevioStatusMatrix'

describe('matrixTone', () => {
  it('maps agent activity to the matrix states', () => {
    expect(matrixTone('working')).toBe('working')
    expect(matrixTone('monitoring')).toBe('working')
    expect(matrixTone('permission')).toBe('attention')
    expect(matrixTone('failed')).toBe('failed')
    expect(matrixTone('done')).toBe('done')
    expect(matrixTone('inactive')).toBe('idle')
  })
})
