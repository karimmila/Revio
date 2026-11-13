import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: Object.assign(() => 0, { getState: () => ({}) }) }))
vi.mock('./RevioLinkRouter', () => ({ copyRevioLink: vi.fn() }))
vi.mock('./open-revio-pull-request', () => ({ openRevioPullRequest: vi.fn() }))
vi.mock('./settings/revio-settings-view', () => ({ openRevioSettingsPage: vi.fn() }))
vi.mock('./use-revio-pull-request', () => ({ usePullRequestForActiveWorkspace: () => null }))
vi.mock('@/lib/repo-action-run', () => ({ worktreeHasRunningAction: () => false }))

const { setupInfoLabel } = await import('./RevioWorkspaceTitle')

describe('setupInfoLabel', () => {
  it("names the workspace's setup state", () => {
    expect(setupInfoLabel('failed')).toBe('Setup failed')
    expect(setupInfoLabel('running')).toBe('Setting up...')
    expect(setupInfoLabel('succeeded')).toBe('Setup succeeded')
  })

  it('hides the line when the workspace ran no setup', () => {
    expect(setupInfoLabel(null)).toBeNull()
  })
})
