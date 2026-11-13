import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CloudHostRow } from './cloud-project-archive'

type MockState = {
  calls: string[]
  handled: boolean
  state: {
    worktreesByRepo: Record<string, CloudHostRow[]>
    removeProject: ReturnType<typeof vi.fn>
  }
}

const h = vi.hoisted((): MockState => ({
  calls: [],
  handled: true,
  state: { worktreesByRepo: {}, removeProject: vi.fn() }
}))

vi.mock('@/store', () => ({ useAppStore: { getState: () => h.state } }))
vi.mock('../sleep/sleep-worktree-flow', () => ({ runSleepWorktree: vi.fn() }))
vi.mock('@/lib/revio-cloud-archive', () => ({
  archiveCloudWorkspace: async (target: { id: string; displayName: string }) => {
    h.calls.push(`archive:${target.displayName}`)
    return h.handled
  }
}))

import { archiveCloudProject, cloudHostWorkspace } from './cloud-project-archive'

const root: CloudHostRow = {
  id: 'vm-repo::/vercel/example-repo',
  repoId: 'vm-repo',
  hostId: 'runtime:env-1',
  displayName: 'hey-just-create-env',
  branch: 'refs/heads/hey-just-create-env',
  head: '082500a1338',
  isMainWorktree: true
}

describe('archiveCloudProject', () => {
  beforeEach(() => {
    h.calls = []
    h.handled = true
    h.state.worktreesByRepo = {
      'vm-repo': [
        { ...root, id: 'other-host', hostId: 'runtime:env-2', displayName: 'not-this-one' },
        root
      ]
    }
    h.state.removeProject = vi.fn(async (repoId: string) => {
      h.calls.push(`removeProject:${repoId}`)
    })
  })

  it('names and archives the workspace on that host, not the repository', () => {
    expect(cloudHostWorkspace(h.state, 'vm-repo', 'runtime:env-1')?.displayName).toBe(
      'hey-just-create-env'
    )
  })

  it('archives the workspace with its restore point instead of removing the project', async () => {
    await archiveCloudProject('vm-repo', 'runtime:env-1')
    expect(h.calls).toEqual(['archive:hey-just-create-env'])
  })

  it('falls back to project removal (guarded in main) only when nothing could archive', async () => {
    h.handled = false
    await archiveCloudProject('vm-repo', 'runtime:env-1')
    expect(h.calls).toEqual(['archive:hey-just-create-env', 'removeProject:vm-repo'])
    h.calls = []
    h.state.worktreesByRepo = {}
    await archiveCloudProject('vm-repo', 'runtime:env-1')
    expect(h.calls).toEqual(['removeProject:vm-repo'])
  })
})
