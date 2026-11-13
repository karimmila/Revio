// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

const summary = vi.hoisted(() => ({
  value: { hasLiveWorking: false, hasPermission: false, hasLiveMonitoring: false }
}))
vi.mock('@/components/sidebar/workspace-card/activity/worktree-agent-activity-summary', () => ({
  selectWorktreeAgentActivitySummary: () => summary.value
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))

const { revioArchivesWithoutAsking } = await import('./revio-archive')

afterEach(() => {
  delete document.documentElement.dataset.revioLayout
  summary.value = { hasLiveWorking: false, hasPermission: false, hasLiveMonitoring: false }
})

describe('revioArchivesWithoutAsking', () => {
  it('archives a quiet workspace without a confirm in the workspace layout', () => {
    document.documentElement.dataset.revioLayout = 'true'
    expect(revioArchivesWithoutAsking('w')).toBe(true)
  })

  it('asks while an agent works or waits, and always outside the layout', () => {
    document.documentElement.dataset.revioLayout = 'true'
    summary.value = { ...summary.value, hasLiveWorking: true }
    expect(revioArchivesWithoutAsking('w')).toBe(false)
    summary.value = { hasLiveWorking: false, hasPermission: true, hasLiveMonitoring: false }
    expect(revioArchivesWithoutAsking('w')).toBe(false)
    delete document.documentElement.dataset.revioLayout
    summary.value = { hasLiveWorking: false, hasPermission: false, hasLiveMonitoring: false }
    expect(revioArchivesWithoutAsking('w')).toBe(false)
  })
})
