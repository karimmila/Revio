import { describe, expect, it, vi } from 'vitest'

vi.mock('../../store', () => ({ useAppStore: { getState: () => ({ settings: {} }) } }))
vi.mock('@/lib/repo-action-run', () => ({
  resolveActionContext: vi.fn(),
  runningRepoActionTab: vi.fn(),
  stopRepoAction: vi.fn()
}))
vi.mock('@/components/revio-layout/revio-action-start', () => ({ startRunnable: vi.fn() }))

import type { RepoAction } from '../../../../shared/actions/repo-actions'
import type { ActionContext } from '../../../../shared/actions/repo-action-runnables'
import {
  handleRepoActionAgentRequest,
  type RepoActionAgentDeps
} from './repo-action-agent-ipc-bridge'

const context: ActionContext = {
  kind: 'local',
  sourceRepoId: 'r1',
  worktreeId: 'r1::/w',
  mirrorWorktreeId: null
}
const tunnel: RepoAction = {
  id: 'shared:0:claim-tunnel',
  name: 'Claim tunnel',
  script: 'ngrok http 3000',
  targets: ['local'],
  shared: true
}

function deps(overrides: Partial<RepoActionAgentDeps> = {}): RepoActionAgentDeps {
  return {
    resolveContext: vi.fn(async () => context),
    listActions: vi.fn(async () => ({
      actions: [tunnel],
      runMode: 'nonconcurrent' as const,
      previewUrls: [],
      sharedFile: '/repo/.orca/actions.toml',
      sharedFileName: '.orca/actions.toml',
      sharedError: null
    })),
    runningTab: vi.fn(() => null),
    stop: vi.fn(() => true),
    start: vi.fn(async () => ({ tabId: 'tab-9', worktreeId: 'r1::/w' })),
    spotlightRepos: () => ['r1'],
    ...overrides
  }
}

const run = {
  requestId: 'q1',
  op: 'run' as const,
  worktreeId: 'r1::/w',
  actionId: tunnel.id,
  location: 'local' as const,
  restart: false
}

describe('handleRepoActionAgentRequest', () => {
  it('returns the workspace action context', async () => {
    expect(
      await handleRepoActionAgentRequest(
        { requestId: 'q0', op: 'context', worktreeId: 'r1::/w' },
        deps()
      )
    ).toEqual({ requestId: 'q0', context })
  })

  it('starts the action through the Run button path with its run mode and Spotlight', async () => {
    const d = deps()
    expect(await handleRepoActionAgentRequest(run, d)).toEqual({
      requestId: 'q1',
      run: { tabId: 'tab-9', worktreeId: 'r1::/w', alreadyRunning: false }
    })
    expect(d.start).toHaveBeenCalledWith(
      context,
      { action: tunnel, worktreeId: 'r1::/w', group: 'local' },
      'nonconcurrent',
      true
    )
  })

  it('leaves a running action alone unless asked to restart', async () => {
    const d = deps({ runningTab: vi.fn(() => 'tab-old') })
    expect(await handleRepoActionAgentRequest(run, d)).toEqual({
      requestId: 'q1',
      run: { tabId: 'tab-old', worktreeId: 'r1::/w', alreadyRunning: true }
    })
    expect(d.start).not.toHaveBeenCalled()
    await handleRepoActionAgentRequest({ ...run, restart: true }, d)
    expect(d.stop).toHaveBeenCalledWith(tunnel.id, 'r1::/w')
    expect(d.start).toHaveBeenCalledTimes(1)
  })

  it('refuses an action id the repository no longer has, or a location it cannot run in', async () => {
    const d = deps()
    expect(await handleRepoActionAgentRequest({ ...run, actionId: 'gone' }, d)).toMatchObject({
      error: 'That action is not available in this workspace.'
    })
    expect(await handleRepoActionAgentRequest({ ...run, location: 'cloud' }, d)).toMatchObject({
      error: 'That action is not available in this workspace.'
    })
    expect(d.start).not.toHaveBeenCalled()
  })

  it('reports a run that could not start', async () => {
    const d = deps({ start: vi.fn(async () => null) })
    expect(await handleRepoActionAgentRequest(run, d)).toEqual({
      requestId: 'q1',
      error: 'Could not start Claim tunnel.'
    })
  })
})
