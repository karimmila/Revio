import { describe, expect, it } from 'vitest'
import type { RepoAction } from './repo-actions'
import { runnableActions, selectAgentAction, type ActionContext } from './repo-action-runnables'

const action = (id: string, name: string, targets: RepoAction['targets']): RepoAction => ({
  id,
  name,
  script: `echo ${name}`,
  targets,
  shared: true
})

const local: ActionContext = {
  kind: 'local',
  sourceRepoId: 'r1',
  worktreeId: 'r1::/w',
  mirrorWorktreeId: null
}
const cloud: ActionContext = { ...local, kind: 'cloud', mirrorWorktreeId: 'r1::/mirror' }
const actions = [
  action('shared:0:claim-tunnel', 'Claim tunnel', ['local']),
  action('shared:1:deploy', 'Deploy', ['cloud', 'mirror'])
]

describe('selectAgentAction', () => {
  it('finds an action by name, ignoring case, or by id', () => {
    const byName = selectAgentAction(local, actions, ' claim TUNNEL ')
    expect(byName).toMatchObject({ ok: true, runnable: { group: 'local', worktreeId: 'r1::/w' } })
    expect(selectAgentAction(local, actions, 'shared:0:claim-tunnel').ok).toBe(true)
  })

  it('refuses a name the repository does not define and lists the real ones', () => {
    const result = selectAgentAction(local, actions, 'rm -rf /')
    expect(result).toEqual({
      ok: false,
      code: 'not_found',
      message: 'No action named "rm -rf /". This repository\'s actions: "Claim tunnel", "Deploy".'
    })
  })

  it('refuses an action that cannot run where this workspace is', () => {
    const result = selectAgentAction(local, actions, 'Deploy')
    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ code: 'unavailable_here' })
    expect(!result.ok && result.message).toContain('cloud workspaces')
    expect(!result.ok && result.message).toContain('this workspace is on this Mac')
  })

  it('runs a cloud workspace action in the sandbox first, or in the mirror when asked', () => {
    expect(selectAgentAction(cloud, actions, 'Deploy')).toMatchObject({
      ok: true,
      runnable: { group: 'cloud', worktreeId: 'r1::/w' }
    })
    expect(selectAgentAction(cloud, actions, 'Deploy', 'mirror')).toMatchObject({
      ok: true,
      runnable: { group: 'mirror', worktreeId: 'r1::/mirror' }
    })
    const noMirror = selectAgentAction(
      { ...cloud, mirrorWorktreeId: null },
      actions,
      'Deploy',
      'mirror'
    )
    expect(!noMirror.ok && noMirror.message).toContain('no local mirror')
  })

  it('asks for the id when two actions share a name', () => {
    const twins = [action('a', 'Dev', ['local']), action('b', 'dev', ['local'])]
    expect(selectAgentAction(local, twins, 'dev')).toMatchObject({ ok: false, code: 'ambiguous' })
    expect(selectAgentAction(local, twins, 'b')).toMatchObject({ ok: true })
  })
})

describe('runnableActions', () => {
  it('pairs each action with the workspace it runs in', () => {
    expect(runnableActions(cloud, actions).map((entry) => [entry.action.id, entry.group])).toEqual([
      ['shared:1:deploy', 'cloud'],
      ['shared:1:deploy', 'mirror']
    ])
  })
})
