import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VERCEL_CLOUD_RECIPE_ID } from '../../../shared/cloud/cloud-recipe'
import type { ArchivedChat } from '../../../shared/revio-archive-types'
import type { ArchivableCloudWorkspace, AsleepCloudRuntime } from './revio-cloud-archive'

type MockState = {
  calls: string[]
  created: unknown[]
  added: unknown[]
  chatsInStore: ArchivedChat[]
  runtimes: AsleepCloudRuntime[]
  storeState: Record<string, unknown>
  retireError: Error | null
}

const h = vi.hoisted((): MockState => ({
  calls: [],
  created: [],
  added: [],
  chatsInStore: [],
  runtimes: [],
  storeState: {},
  retireError: null
}))

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => h.storeState,
    setState: (update: (state: Record<string, unknown>) => Record<string, unknown>) => {
      h.calls.push('archiving')
      h.storeState = { ...h.storeState, ...update(h.storeState) }
    },
    subscribe: () => () => {}
  }
}))
vi.mock('@/store/slices/worktrees/teardown/worktree-delete-state', () => ({
  getWorktreeDeleteStateKey: (_state: unknown, worktreeId: string) => worktreeId
}))
vi.mock('@/store/workspace-record-selectors', () => ({ selectWorktreesByRepo: () => ({}) }))
vi.mock('@/lib/workspace/creation/worktree-creation-flow', () => ({
  runBackgroundWorktreeCreation: (request: unknown) => {
    h.created.push(request)
    return 'creation-1'
  }
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('./revio-archive-chats', () => ({ archivedChatsInStore: () => h.chatsInStore }))
vi.mock('./cloud-restored-workspace', () => ({
  cloudWorktreeIdsOnBranch: () => new Set<string>(),
  settledCloudWorktree: async (creationId: string) => {
    h.calls.push(`settled:${creationId}`)
    return 'vm-repo::/vercel/example-repo'
  },
  resumeChatsInCloudWorkspace: async (
    worktreeId: string,
    archivedId: string,
    chats: ArchivedChat[]
  ) => {
    h.calls.push(`resume:${worktreeId}:${archivedId}:${chats.map((chat) => chat.sessionId).join(',')}`)
  }
}))

const { archiveCloudWorkspace, asleepCloudArchiveRecord, cloudRuntimeFor } =
  await import('./revio-cloud-archive')
const { unarchiveCloudWorkspace } = await import('./revio-cloud-unarchive')

function runtime(
  status: AsleepCloudRuntime['status'],
  overrides: Partial<AsleepCloudRuntime> = {}
): AsleepCloudRuntime {
  return {
    id: 'rt-1',
    recipeId: VERCEL_CLOUD_RECIPE_ID,
    status,
    cleanupStatus: 'not_started',
    runtimeEnvironmentId: 'env-1',
    repoId: 'mac-repo',
    projectId: 'project-1',
    ...overrides
  }
}

const workspace: ArchivableCloudWorkspace = {
  id: 'vm-repo::/vercel/example-repo',
  repoId: 'vm-repo',
  hostId: 'runtime:env-1',
  displayName: 'say-ok',
  branch: 'refs/heads/me/say-ok',
  head: 'abc1234def',
  isMainWorktree: false
}

describe('cloudRuntimeFor', () => {
  it('finds the running or asleep cloud sandbox behind the workspace host', () => {
    const asleep = runtime('suspended', {
      workspaceName: 'feat',
      recipeResult: { userData: { branch: 'me/feat', startCommit: 'def5678' } }
    })
    expect(cloudRuntimeFor(workspace, [asleep])).toEqual({
      id: 'rt-1',
      repoId: 'mac-repo',
      projectId: 'project-1',
      asleep: true,
      facts: { branch: 'me/feat', startCommit: 'def5678', workspaceName: 'feat' }
    })
    expect(cloudRuntimeFor(workspace, [runtime('resume_failed')])).not.toBeNull()
    expect(cloudRuntimeFor(workspace, [runtime('running')])?.asleep).toBe(false)
    expect(cloudRuntimeFor(workspace, [runtime('provisioning')])).toBeNull()
    // A sandbox whose sleep or an earlier destroy failed may still hold work: still archivable.
    expect(cloudRuntimeFor(workspace, [runtime('suspend_failed')])?.asleep).toBe(true)
    expect(cloudRuntimeFor(workspace, [runtime('cleanup_failed')])?.asleep).toBe(true)
    expect(
      cloudRuntimeFor(workspace, [runtime('cleaned', { cleanupStatus: 'succeeded' })])
    ).toBeNull()
    expect(cloudRuntimeFor(workspace, [runtime('suspended', { recipeId: 'x' })])).toBeNull()
    expect(
      cloudRuntimeFor(workspace, [runtime('suspended', { runtimeEnvironmentId: 'env-2' })])
    ).toBeNull()
    expect(cloudRuntimeFor({ hostId: 'local' }, [runtime('suspended')])).toBeNull()
  })
})

describe('asleepCloudArchiveRecord', () => {
  const owner = { repoId: 'mac-repo', projectId: 'project-1' }

  it('records the Mac repository, branch, commit and restore point', () => {
    expect(asleepCloudArchiveRecord(workspace, owner, 'snap_abc12345', 7)).toEqual({
      id: workspace.id,
      repoId: 'mac-repo',
      displayName: 'say-ok',
      branch: 'me/say-ok',
      archiveCommit: 'abc1234def',
      archivedAt: 7,
      cloud: true,
      cloudRestore: { projectId: 'project-1', snapshotId: 'snap_abc12345' }
    })
    expect(asleepCloudArchiveRecord({ ...workspace, branch: '' }, owner, null, 1)).toBeNull()
  })

  it('falls back to what the recipe recorded when the asleep row has no branch or HEAD', () => {
    expect(
      asleepCloudArchiveRecord(
        { ...workspace, displayName: 'example-repo', branch: '', head: '' },
        { ...owner, facts: { branch: 'me/feat', startCommit: 'def5678', workspaceName: 'feat' } },
        null,
        1
      )
    ).toMatchObject({ displayName: 'feat', branch: 'me/feat', archiveCommit: 'def5678' })
  })
})

describe('archiveCloudWorkspace', () => {
  const deps = {
    sleep: async (worktreeId: string) => {
      h.calls.push(`sleep:${worktreeId}`)
      // Sleep suspends the runtime record; the archive waits for that before retiring.
      h.runtimes = [runtime('suspended')]
      return [{ completed: true }]
    },
    pause: async () => {}
  }

  beforeEach(() => {
    h.calls = []
    h.retireError = null
    h.created = []
    h.added = []
    h.chatsInStore = []
    h.runtimes = [runtime('suspended')]
    h.storeState = {
      clearWorktreeDeleteState: () => h.calls.push('clear'),
      deleteStateByWorktreeId: {},
      removeWorktree: async (_target: unknown, _force: boolean, options: { mode: string }) => {
        h.calls.push(`remove:${options.mode}`)
        return { ok: true }
      },
      removeProject: async (repoId: string, options: { hostId: string }) => {
        h.calls.push(`removeProject:${repoId}:${options.hostId}`)
      },
      repos: [{ id: 'mac-repo', path: '/repo' }],
      pendingWorktreeCreations: { 'creation-1': {} }
    }
    vi.stubGlobal('window', {
      api: {
        ephemeralVm: { listRuntimes: async () => h.runtimes },
        cloud: {
          retireAsleepSandbox: async (id: string) => {
            if (h.retireError) {
              throw h.retireError
            }
            h.calls.push(`retire:${id}`)
            return { restoreSnapshotId: 'snap_abc12345' }
          },
          prepareRestore: async (args: { snapshotId: string | null }) => {
            h.calls.push(`prepare:${args.snapshotId}`)
          }
        },
        revioArchive: {
          add: async (record: { cloud: boolean }) => {
            h.added.push(record)
            h.calls.push(`add:${record.cloud}`)
          }
        }
      }
    })
  })

  it('retires the sandbox, records the archive and removes its VM project, never waking it', async () => {
    expect(await archiveCloudWorkspace(workspace, deps)).toBe(true)
    expect(h.calls).toEqual([
      'archiving',
      'retire:rt-1',
      'add:true',
      'removeProject:vm-repo:runtime:env-1',
      'clear'
    ])
  })

  it('removes a provisioned-root workspace with its VM project', async () => {
    expect(await archiveCloudWorkspace({ ...workspace, isMainWorktree: true }, deps)).toBe(true)
    expect(h.calls).toEqual([
      'archiving',
      'retire:rt-1',
      'add:true',
      'removeProject:vm-repo:runtime:env-1',
      'clear'
    ])
  })

  it('keeps the workspace when main could not keep a restore point', async () => {
    h.retireError = new Error('Vercel kept no snapshot of this cloud workspace, so it was kept.')
    expect(await archiveCloudWorkspace(workspace, deps)).toBe(true)
    expect(h.calls).toEqual(['archiving', 'clear'])
  })

  it('puts an awake workspace to sleep first so its stop snapshot keeps the work', async () => {
    h.runtimes = [runtime('running')]
    expect(await archiveCloudWorkspace(workspace, deps)).toBe(true)
    expect(h.calls).toEqual([
      'archiving',
      `sleep:${workspace.id}`,
      'retire:rt-1',
      'add:true',
      'removeProject:vm-repo:runtime:env-1',
      'clear'
    ])
  })

  it('keeps an awake workspace whose sleep did not complete', async () => {
    h.runtimes = [runtime('running')]
    const failedSleep = { ...deps, sleep: async () => [{ completed: false }] }
    expect(await archiveCloudWorkspace(workspace, failedSleep)).toBe(true)
    expect(h.calls).toEqual(['archiving', 'clear'])
  })

  it('leaves a sandbox that is still being set up to the normal archive', async () => {
    h.runtimes = [runtime('provisioning')]
    expect(await archiveCloudWorkspace(workspace, deps)).toBe(false)
    expect(h.calls).toEqual([])
  })

  it('unarchives as a new cloud workspace armed to start from the restore point', async () => {
    const record = asleepCloudArchiveRecord(
      workspace,
      { repoId: 'mac-repo', projectId: 'project-1' },
      'snap_abc12345',
      1
    )
    expect(record).not.toBeNull()
    expect(record && (await unarchiveCloudWorkspace(record))).toBe(true)
    expect(h.calls).toEqual(['prepare:snap_abc12345'])
    expect(h.created).toEqual([
      expect.objectContaining({
        repoId: 'mac-repo',
        name: 'say-ok',
        branchNameOverride: 'me/say-ok',
        ephemeralVmRecipe: {
          sourceRepoId: 'mac-repo',
          recipeId: VERCEL_CLOUD_RECIPE_ID,
          projectId: 'project-1',
          checkoutMode: 'provisioned-root'
        }
      })
    ])
  })

  it('records the chats read before the sleep stops their agents', async () => {
    const chat: ArchivedChat = {
      agent: 'claude',
      sessionId: 'claude_1',
      providerSessionId: 'prov-1',
      title: 'Say ok'
    }
    h.chatsInStore = [chat]
    h.runtimes = [runtime('running')]
    const sleepClearsChats = {
      ...deps,
      sleep: async (worktreeId: string) => {
        h.chatsInStore = []
        return deps.sleep(worktreeId)
      }
    }
    expect(await archiveCloudWorkspace(workspace, sleepClearsChats)).toBe(true)
    expect(h.added).toEqual([expect.objectContaining({ chats: [chat] })])
  })

  it('hands the archived chats, with their records, to the restored workspace once it is made', async () => {
    const chats: ArchivedChat[] = [{ agent: 'claude', sessionId: 'claude_1', providerSessionId: 'prov-1' }]
    const record = asleepCloudArchiveRecord(
      workspace,
      { repoId: 'mac-repo', projectId: 'project-1' },
      'snap_abc12345',
      1,
      chats
    )
    expect(record?.chats).toEqual(chats)
    expect(record && (await unarchiveCloudWorkspace(record))).toBe(true)
    await vi.waitFor(() =>
      expect(h.calls).toEqual([
        'prepare:snap_abc12345',
        'settled:creation-1',
        'resume:vm-repo::/vercel/example-repo:vm-repo::/vercel/example-repo:claude_1'
      ])
    )
  })
})
