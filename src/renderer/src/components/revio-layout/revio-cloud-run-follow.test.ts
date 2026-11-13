// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
  state: {} as {
    activeWorktreeId: string | null
    tabsByWorktree: Record<string, { id: string; customTitle: string | null }[]>
    closeTab: ReturnType<typeof vi.fn>
  },
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
  owners: {} as Record<string, string>,
  remote: true,
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
  context: { kind: 'cloud', sourceRepoId: 'src' } as { kind: string; sourceRepoId: string } | null,
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
  actions: [{ targets: ['cloud'] }] as { targets: string[] }[],
  routeReady: true,
  start: vi.fn()
}))

vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('@/lib/repo-action-run', () => ({ resolveActionContext: async () => mocks.context }))
vi.mock('./revio-dock-terminals', () => ({
  isDockTabForWorkspace: (tabId: string, worktreeId: string) => mocks.owners[tabId] === worktreeId,
  isRemoteWorkspace: () => mocks.remote
}))
vi.mock('./revio-cloud-dock', () => ({
  prepareCloudDockForWorktree: async () => mocks.routeReady
}))
vi.mock('./revio-dock-background-start', () => ({
  startInRevioDockInBackground: mocks.start
}))

const { followCloudRuns, stopFollowingCloudRuns } = await import('./revio-cloud-run-follow')
const { cloudActionRunsFollow } = await import('../../../../shared/cloud/cloud-action-runs')

beforeEach(() => {
  mocks.state = { activeWorktreeId: 'cw', tabsByWorktree: {}, closeTab: vi.fn() }
  mocks.owners = {}
  mocks.remote = true
  mocks.context = { kind: 'cloud', sourceRepoId: 'src' }
  mocks.actions = [{ targets: ['cloud'] }]
  mocks.routeReady = true
  mocks.start.mockReset()
  mocks.start.mockImplementation(() => {
    mocks.owners['follow'] = 'cw'
    mocks.state.tabsByWorktree['global-floating-terminal'] = [{ id: 'follow', customTitle: 'Run' }]
    return 'follow'
  })
  Object.assign(window, {
    api: { repoActions: { list: async () => ({ actions: mocks.actions }) } }
  })
  stopFollowingCloudRuns(null)
})

describe('followCloudRuns', () => {
  it('opens a Run tab that follows the agent runs, without showing the panel', async () => {
    await followCloudRuns('cw')
    expect(mocks.start).toHaveBeenCalledWith(
      'cw',
      'Run',
      cloudActionRunsFollow('No runs yet. Runs you or the agent start show here.'),
      undefined,
      {
        reveal: false
      }
    )
  })

  it('skips Mac workspaces, repositories without cloud actions and sleeping sandboxes', async () => {
    mocks.remote = false
    await followCloudRuns('cw')
    mocks.remote = true
    mocks.actions = [{ targets: ['local'] }]
    await followCloudRuns('cw')
    mocks.actions = [{ targets: ['cloud'] }]
    mocks.routeReady = false
    await followCloudRuns('cw')
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it("leaves a person's own Run tab alone", async () => {
    mocks.owners['mine'] = 'cw'
    mocks.state.tabsByWorktree['global-floating-terminal'] = [{ id: 'mine', customTitle: 'Run' }]
    await followCloudRuns('cw')
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('does nothing when the person moved on while the route was read', async () => {
    mocks.state.activeWorktreeId = 'other'
    await followCloudRuns('cw')
    expect(mocks.start).not.toHaveBeenCalled()
  })
})

describe('stopFollowingCloudRuns', () => {
  it('closes the follower once its workspace is no longer open', async () => {
    await followCloudRuns('cw')
    stopFollowingCloudRuns('cw')
    expect(mocks.state.closeTab).not.toHaveBeenCalled()
    stopFollowingCloudRuns('other')
    expect(mocks.state.closeTab).toHaveBeenCalledWith('follow', { recordInteraction: false })
  })

  it("does not close a tab a person's run put in its place", async () => {
    await followCloudRuns('cw')
    mocks.state.tabsByWorktree['global-floating-terminal'] = [{ id: 'mine', customTitle: 'Run' }]
    stopFollowingCloudRuns(null)
    expect(mocks.state.closeTab).not.toHaveBeenCalled()
  })
})
