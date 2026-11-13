import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(
  (): { gitBranchCompareSummaryByWorktree: Record<string, { baseRef: string }> } => ({
    gitBranchCompareSummaryByWorktree: {}
  })
)
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/store', () => ({ useAppStore: { getState: () => state } }))
vi.mock('@/store/workspace-record-selectors', () => ({ selectWorktreesByRepo: () => ({}) }))
vi.mock('@/store/slices/worktree-helpers', () => ({
  findWorktreeById: () => ({ id: 'w', path: '/w' })
}))

const { continueOnNewBranch } = await import('./RevioContinueButton')
const run = vi.fn()
beforeEach(() => {
  run.mockReset()
  toast.success.mockClear()
  toast.error.mockClear()
  vi.stubGlobal('window', { api: { git: { continueOnNewBranch: run } } })
})

it("continues from the workspace's target branch", async () => {
  state.gitBranchCompareSummaryByWorktree = { w: { baseRef: 'origin/main' } }
  run.mockResolvedValue({ branch: 'feat-2', base: 'origin/main' })
  expect(await continueOnNewBranch('w')).toBe(true)
  expect(run).toHaveBeenCalledWith({ worktreePath: '/w', baseRef: 'origin/main' })
  expect(toast.success).toHaveBeenCalledWith('Switched to feat-2 off origin/main')
})

it('says so when the target branch is unknown or git refuses', async () => {
  state.gitBranchCompareSummaryByWorktree = {}
  expect(await continueOnNewBranch('w')).toBe(false)
  expect(run).not.toHaveBeenCalled()
  state.gitBranchCompareSummaryByWorktree = { w: { baseRef: 'origin/main' } }
  run.mockRejectedValue(new Error('would be overwritten'))
  expect(await continueOnNewBranch('w')).toBe(false)
  expect(toast.error).toHaveBeenLastCalledWith('Could not continue', {
    description: 'would be overwritten'
  })
})
