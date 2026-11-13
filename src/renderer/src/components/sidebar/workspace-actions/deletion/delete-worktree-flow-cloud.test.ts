import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = {
  id: string
  instanceId: string
  repoId: string
  path: string
  displayName: string
  isMainWorktree: boolean
  hostId?: string
}

const h = vi.hoisted(() => {
  const rows = new Map<string, Row>()
  const repos: { id: string; displayName: string }[] = []
  const archived: string[] = []
  const state = {
    settings: { skipDeleteWorktreeConfirm: false, revioLayout: false },
    repos,
    sshTargetLabels: new Map<string, string>(),
    worktreeLineageById: {},
    clearWorktreeDeleteState: vi.fn(),
    openModal: vi.fn(),
    removeWorktree: vi.fn()
  }
  return { rows, state, archived, handled: true }
})

vi.mock('@/store', () => ({ useAppStore: { getState: () => h.state } }))
vi.mock('@/store/selectors', () => ({
  getAllWorktreesFromState: () => [...h.rows.values()],
  getWorktreeOnHostFromState: (_state: unknown, id: string, hostId?: string) => {
    const row = h.rows.get(id)
    return row && (!hostId || row.hostId === hostId) ? row : undefined
  }
}))
vi.mock('@/lib/revio-archive', () => ({
  keepRevioArchiveRecord: () => null,
  revioArchivesWithoutAsking: () => false
}))
vi.mock('@/lib/revio-cloud-archive', () => ({
  archiveCloudWorkspace: async (target: Row) => {
    h.archived.push(target.id)
    return h.handled
  }
}))
vi.mock('@/lib/cloud-workspaces', () => ({
  cloudEnvironmentIdsNow: () => new Set(['env-cloud'])
}))
vi.mock('../sleep/sleep-worktree-flow', () => ({ runSleepWorktree: vi.fn() }))
vi.mock('@/components/editor/save/flush/removal-unsaved-editor-files', () => ({
  collectRemovalUnsavedFiles: () => []
}))
vi.mock('./worktree-delete-execution', () => ({ runWorktreeDeletesInParallel: vi.fn() }))
vi.mock('./run-worktree-delete-with-toast', () => ({ runWorktreeDeleteWithToast: vi.fn() }))

import { runWorktreeBatchDelete, runWorktreeDelete } from './delete-worktree-flow'

function row(id: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    instanceId: `${id}-i`,
    repoId: 'repo-1',
    path: `/w/${id}`,
    displayName: id,
    isMainWorktree: false,
    ...overrides
  }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('cloud workspaces in the delete flow', () => {
  beforeEach(() => {
    h.rows.clear()
    h.archived = []
    h.handled = true
    h.state.openModal.mockClear()
    h.state.removeWorktree.mockClear()
  })

  it('archives a cloud workspace in either layout, never removing it', async () => {
    h.rows.set('cloud', row('cloud', { hostId: 'runtime:env-cloud', isMainWorktree: true }))
    runWorktreeDelete('cloud')
    await flush()
    expect(h.archived).toEqual(['cloud'])
    expect(h.state.openModal).not.toHaveBeenCalled()
    expect(h.state.removeWorktree).not.toHaveBeenCalled()
  })

  it('names the workspace when a cloud root falls through to the archive dialog', async () => {
    h.handled = false
    h.state.repos = [{ id: 'repo-1', displayName: 'example-repo' }]
    h.rows.set(
      'cloud',
      row('cloud', {
        hostId: 'runtime:env-cloud',
        isMainWorktree: true,
        displayName: 'hey-just-create-env'
      })
    )
    runWorktreeDelete('cloud')
    await flush()
    expect(h.state.openModal).toHaveBeenCalledWith(
      'confirm-remove-folder',
      expect.objectContaining({ workspaceName: 'hey-just-create-env' })
    )
  })

  it('takes cloud workspaces out of a batch delete and archives each one', async () => {
    h.rows.set('cloud', row('cloud', { hostId: 'runtime:env-cloud' }))
    h.rows.set('local', row('local'))
    expect(
      runWorktreeBatchDelete([
        { id: 'cloud', instanceId: 'cloud-i', hostId: 'runtime:env-cloud' },
        { id: 'local', instanceId: 'local-i' }
      ])
    ).toBe(true)
    await flush()
    expect(h.archived).toEqual(['cloud'])
    expect(h.state.openModal).toHaveBeenCalledWith(
      'delete-worktree',
      expect.objectContaining({ worktreeId: 'local' })
    )
  })

  it('opens no delete dialog when the batch held only cloud workspaces', async () => {
    h.rows.set('cloud', row('cloud', { hostId: 'runtime:env-cloud' }))
    expect(
      runWorktreeBatchDelete([{ id: 'cloud', instanceId: 'cloud-i', hostId: 'runtime:env-cloud' }])
    ).toBe(true)
    await flush()
    expect(h.archived).toEqual(['cloud'])
    expect(h.state.openModal).not.toHaveBeenCalled()
  })
})
