import { expect, it, vi } from 'vitest'

const quiet = vi.hoisted(() => ({ value: true }))
vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ worktreesByRepo: { r: [{ id: 'r::/w', path: '/w' }] } }) }
}))
vi.mock('@/lib/revio-archive', () => ({ revioArchivesWithoutAsking: () => quiet.value }))

const { confirmBranchSwitch } = await import('./revio-branch-switch-guard')

it('switches without asking when no agent runs, and asks while one does', async () => {
  const confirm = vi.fn(async () => false)
  expect(await confirmBranchSwitch(confirm, '/w', 'feature')).toBe(true)
  expect(confirm).not.toHaveBeenCalled()
  quiet.value = false
  expect(await confirmBranchSwitch(confirm, '/w', 'feature')).toBe(false)
  expect(confirm).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Switch branch?', confirmLabel: 'Switch anyway' })
  )
})
