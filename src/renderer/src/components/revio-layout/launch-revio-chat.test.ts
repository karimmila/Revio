import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double; the code under test reads only the fields set here
  state: {} as Record<string, unknown>,
  launch: vi.fn((_args: Record<string, unknown>) => ({ tabId: 't' }))
}))

vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.state } }))
const toastMessage = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { error: vi.fn(), message: toastMessage } }))
vi.mock('@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab', () => ({
  launchAgentInNewTab: mocks.launch
}))
vi.mock('@/lib/agent-session/launch/routing/agent-launch-request-id', () => ({
  newAgentLaunchRequestId: () => 'req'
}))
vi.mock('@/lib/cloud-workspaces', () => ({
  cloudEnvironmentIdsNow: () => new Set(['env-1']),
  isCloudRepo: (repo: { executionHostId?: string }) => repo.executionHostId === 'runtime:env-1'
}))
// This Mac's model for the agent, as the Create card's first chat of a cloud workspace gets it.
vi.mock('@/components/new-workspace/use-composer-chat-options', () => ({
  resolveComposerLaunchDefaults: async () => ({ model: 'opus-5.5', effort: 'high' })
}))
vi.mock('./revio-prompts-for-worktree', () => ({ revioPromptsForWorktree: () => ({}) }))
// What git answers when asked now; the store's own lists are deliberately never consulted.
const git = vi.hoisted(() => ({
  status: vi.fn(async (): Promise<{ entries: unknown[] }> => ({ entries: [] })),
  compare: vi.fn(async (): Promise<{ summary: Record<string, unknown> }> => ({
    summary: { status: 'ready', changedFiles: 0, commitsAhead: 0 }
  }))
}))
vi.mock('@/runtime/runtime-git-status-client', () => ({ getRuntimeGitStatus: git.status }))
vi.mock('@/runtime/runtime-git-diff-client', () => ({ getRuntimeGitBranchCompare: git.compare }))
vi.mock('@/lib/resolve-owner', () => ({
  runtimeTargetForWorkspaceOwner: () => ({ kind: 'local' })
}))
vi.mock('@/lib/connection-context', () => ({ getConnectionId: () => null }))

const { launchRevioAgentChat, requestRevioReview } = await import('./launch-revio-chat')

function lastLaunch(): Record<string, unknown> {
  return mocks.launch.mock.calls.at(-1)?.[0] ?? {}
}

beforeEach(() => {
  mocks.launch.mockClear()
  mocks.state = {
    settings: {
      defaultTuiAgent: 'claude',
      nativeChatSessionOptions: { claude: { model: 'opus-5.5' } }
    },
    unifiedTabsByWorktree: {},
    repos: [
      { id: 'mac', executionHostId: 'local' },
      { id: 'cloud', executionHostId: 'runtime:env-1' }
    ],
    worktreesByRepo: {
      mac: [{ id: 'w', repoId: 'mac' }],
      cloud: [{ id: 'cw', repoId: 'cloud' }]
    }
  }
})

describe('launchRevioAgentChat', () => {
  it("names this Mac's default model, which a cloud host would not read", () => {
    launchRevioAgentChat('w', { prompt: 'Create a PR' })
    expect(lastLaunch()).toMatchObject({
      agent: 'claude',
      sessionOptions: { model: 'opus-5.5' },
      chatSessionOptions: { model: 'opus-5.5' },
      prompt: 'Create a PR'
    })
  })

  it('keeps a model the caller picked (the Review model)', () => {
    launchRevioAgentChat('w', { prompt: 'Review', model: 'sonnet-5.5' })
    expect(lastLaunch()).toMatchObject({ sessionOptions: { model: 'sonnet-5.5' } })
  })

  it('leaves the model to the agent when no default is saved', () => {
    mocks.state.settings = { defaultTuiAgent: 'codex' }
    launchRevioAgentChat('w', {})
    expect(lastLaunch().agent).toBe('codex')
    expect(lastLaunch().sessionOptions).toBeUndefined()
  })

  it("gives a cloud workspace's Create PR chat this Mac's model, not the sandbox default", async () => {
    mocks.state.settings = { defaultTuiAgent: 'claude' }
    launchRevioAgentChat('cw', { prompt: 'Create a PR' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(lastLaunch()).toMatchObject({
      worktreeId: 'cw',
      sessionOptions: { model: 'opus-5.5', effort: 'high' },
      chatSessionOptions: { model: 'opus-5.5', effort: 'high' }
    })
  })
})

describe('requestRevioReview', () => {
  beforeEach(() => {
    git.status.mockReset().mockResolvedValue({ entries: [] })
    git.compare.mockReset().mockResolvedValue({
      summary: { status: 'ready', changedFiles: 0, commitsAhead: 0 }
    })
    toastMessage.mockClear()
    mocks.state.worktreesByRepo = { mac: [{ id: 'w', repoId: 'mac', path: '/w', baseRef: 'main' }] }
  })

  it('says there is nothing to review on a clean branch instead of starting a chat', async () => {
    expect(await requestRevioReview('w')).toBe(false)
    expect(mocks.launch).not.toHaveBeenCalled()
    expect(toastMessage).toHaveBeenCalledWith('No changes to review')
    expect(git.compare).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: '/w' }),
      'main'
    )
  })

  it('reviews what the agent just wrote, though the store has not loaded it yet', async () => {
    mocks.state.gitStatusByWorktree = { w: [] }
    git.status.mockResolvedValue({ entries: [{ path: 'a.ts' }] })
    expect(await requestRevioReview('w')).toBe(true)
    expect(toastMessage).not.toHaveBeenCalled()
    // The branch need not be compared once the worktree is known to have changes.
    expect(git.compare).not.toHaveBeenCalled()
  })

  it('reviews a clean worktree whose branch is ahead, and one git cannot answer for', async () => {
    git.compare.mockResolvedValueOnce({
      summary: { status: 'ready', changedFiles: 2, commitsAhead: 1 }
    })
    expect(await requestRevioReview('w')).toBe(true)
    git.status.mockRejectedValueOnce(new Error('git failed'))
    expect(await requestRevioReview('w')).toBe(true)
    git.compare.mockRejectedValueOnce(new Error('git failed'))
    expect(await requestRevioReview('w')).toBe(true)
    expect(mocks.launch).toHaveBeenCalledTimes(3)
  })
})
