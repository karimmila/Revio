import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExecutionHostId } from '../../../../../../shared/execution-host'

type MockWorktreeDeleteState = {
  isDeleting?: boolean
  error?: string | null
  canForceDelete?: boolean
  forceDeleteReason?: 'dirty' | null
  lockReason?: string | null
  canWaiveArchiveHook?: boolean
  executionHostId?: ExecutionHostId | null
}

const mocks = vi.hoisted(() => {
  const gitStatusByWorktree: Record<string, unknown[]> = {}
  const deleteStateByWorktreeId: Record<string, MockWorktreeDeleteState> = {}
  const openFiles: {
    id: string
    filePath: string
    worktreeId: string
    isDirty: boolean
    mode: 'edit'
  }[] = []
  const state = {
    settings: { skipDeleteWorktreeConfirm: false },
    worktreeMap: new Map<
      string,
      {
        id: string
        instanceId: string
        repoId: string
        path: string
        displayName: string
        isMainWorktree: boolean
        hostId?: ExecutionHostId
        removalError?: string
      }
    >(),
    repos: [] as { id: string; displayName: string; connectionId?: string }[],
    sshTargetLabels: new Map<string, string>(),
    sshConnectionStates: new Map<string, { status: string }>(),
    worktreeLineageById: {},
    allWorktrees: () => Array.from(state.worktreeMap.values()),
    clearWorktreeDeleteState: vi.fn((worktreeId: string) => {
      delete state.deleteStateByWorktreeId[worktreeId]
    }),
    markWorktreesDeleting: vi.fn((worktreeIds: readonly string[]) => {
      for (const worktreeId of new Set(worktreeIds)) {
        state.deleteStateByWorktreeId[worktreeId] = {
          isDeleting: true,
          error: null,
          canForceDelete: false
        }
      }
    }),
    openModal: vi.fn(),
    setRightSidebarTab: vi.fn(),
    setRightSidebarOpen: vi.fn(),
    removeWorktree: vi.fn().mockResolvedValue({ ok: true }),
    gitStatusByWorktree,
    deleteStateByWorktreeId,
    openFiles,
    editorDrafts: {},
    editorBufferIdOf: {},
    editorBufferViews: {}
  }
  return { state }
})

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => mocks.state
  }
}))

vi.mock('@/store/selectors', () => ({
  getAllWorktreesFromState: () => Array.from(mocks.state.worktreeMap.values()),
  getWorktreeMapFromState: () => mocks.state.worktreeMap,
  // Match declared hosts even though this fixture indexes only one worktree per ID.
  getWorktreeOnHostFromState: (_state: unknown, worktreeId: string, hostId?: string) => {
    const row = mocks.state.worktreeMap.get(worktreeId)
    return row && (!hostId || row.hostId === hostId) ? row : undefined
  }
}))

vi.mock('@/components/editor/model-lifetime/identity/editor-model-owner', () => ({
  resolveEditorModelOwner: () => ({ environmentId: null, hostId: 'local' }),
  getEditorModelOwnerKey: () => ''
}))

vi.mock('@/lib/workspace/activation/worktree-activation', () => ({
  activateAndRevealWorktree: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(() => 'toast-1'),
    dismiss: vi.fn()
  }
}))

vi.mock('./delete-worktree-failure-toast', () => ({
  showDeleteWorktreeFailureToast: vi.fn()
}))

const archive = vi.hoisted(() => ({
  keep: vi.fn((): Promise<string | null> | null => null),
  withoutAsking: vi.fn(() => false),
  unarchive: vi.fn(async () => true)
}))
const uncommittedCount = vi.hoisted(() => vi.fn(async (): Promise<number | null> => 1))
vi.mock('@/components/revio-layout/revio-create-pr-precheck', () => ({
  readUncommittedCount: uncommittedCount
}))
vi.mock('@/lib/workspace/activation/worktree-activation', () => ({
  activateAndRevealWorktree: vi.fn()
}))
vi.mock('@/lib/revio-archive', () => ({
  keepRevioArchiveRecord: archive.keep,
  revioArchivesWithoutAsking: archive.withoutAsking,
  unarchiveRevioWorkspace: archive.unarchive
}))

import { toast } from 'sonner'
import { showDeleteWorktreeFailureToast } from './delete-worktree-failure-toast'

import { runWorktreeDeletesInParallel } from './worktree-delete-execution'
import { runWorktreeDelete } from './delete-worktree-flow'

function setWorktrees(
  worktrees: {
    id: string
    instanceId?: string
    repoId?: string
    path?: string
    displayName?: string
    isMainWorktree?: boolean
    hostId?: ExecutionHostId
    removalError?: string
  }[]
): void {
  mocks.state.worktreeMap = new Map(
    worktrees.map((worktree) => [
      worktree.id,
      {
        id: worktree.id,
        instanceId: worktree.instanceId ?? `${worktree.id}-instance`,
        repoId: worktree.repoId ?? 'repo-1',
        path: worktree.path ?? `/workspaces/${worktree.id}`,
        displayName: worktree.displayName ?? worktree.id,
        isMainWorktree: worktree.isMainWorktree ?? false,
        ...(worktree.hostId ? { hostId: worktree.hostId } : {}),
        ...(worktree.removalError ? { removalError: worktree.removalError } : {})
      }
    ])
  )
}

describe('delete worktree flow', () => {
  beforeEach(() => {
    mocks.state.settings = { skipDeleteWorktreeConfirm: false }
    mocks.state.clearWorktreeDeleteState.mockClear()
    mocks.state.markWorktreesDeleting.mockClear()
    mocks.state.openModal.mockClear()
    mocks.state.removeWorktree.mockClear().mockResolvedValue({ ok: true })
    mocks.state.deleteStateByWorktreeId = {}
    mocks.state.gitStatusByWorktree = {}
    mocks.state.worktreeLineageById = {}
    mocks.state.repos = []
    mocks.state.sshTargetLabels = new Map()
    mocks.state.sshConnectionStates = new Map()
    mocks.state.openFiles = []
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.info).mockClear()
    vi.mocked(showDeleteWorktreeFailureToast).mockClear()
    setWorktrees([])
  })

  it('revalidates each queued instance immediately before execution', async () => {
    // Model a host relying on renderer serialization for same-repo branch cleanup.
    setWorktrees([
      {
        id: 'wt-1',
        instanceId: 'instance-1',
        path: '/workspaces/first-longer',
        hostId: 'ssh:builder'
      },
      { id: 'wt-2', instanceId: 'instance-2', path: '/workspaces/second', hostId: 'ssh:builder' }
    ])
    const targets = Array.from(mocks.state.worktreeMap.values())
    let finishFirst!: (result: { ok: true }) => void
    mocks.state.removeWorktree.mockImplementationOnce(
      () => new Promise((resolve) => (finishFirst = resolve))
    )

    const deletion = runWorktreeDeletesInParallel(targets)
    await vi.waitFor(() =>
      expect(mocks.state.removeWorktree).toHaveBeenCalledWith(
        { id: 'wt-1', executionHostId: 'ssh:builder' },
        false,
        {
          suppressPreservedBranchToast: true
        }
      )
    )
    setWorktrees([
      {
        id: 'wt-1',
        instanceId: 'instance-1',
        path: '/workspaces/first-longer',
        hostId: 'ssh:builder'
      },
      {
        id: 'wt-2',
        instanceId: 'replacement-instance',
        path: '/workspaces/second',
        hostId: 'ssh:builder'
      }
    ])
    finishFirst({ ok: true })

    await expect(deletion).resolves.toEqual([{ id: 'wt-1', executionHostId: 'ssh:builder' }])
    expect(mocks.state.removeWorktree).not.toHaveBeenCalledWith(
      { id: 'wt-2', executionHostId: 'ssh:builder' },
      false,
      {
        suppressPreservedBranchToast: true
      }
    )
    expect(toast.info).toHaveBeenCalledWith(
      'Workspace list changed',
      expect.objectContaining({
        description: 'Refresh Space and try again if the workspace list looks stale.'
      })
    )
  })

  it('archives a workspace with uncommitted work once its checkpoint is saved (Workspace layout)', async () => {
    setWorktrees([{ id: 'wt-dirty' }])
    archive.keep.mockReturnValueOnce(Promise.resolve('archive-1'))
    archive.withoutAsking.mockReturnValueOnce(true)
    runWorktreeDelete('wt-dirty')
    await vi.waitFor(() =>
      expect(mocks.state.removeWorktree).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'wt-dirty' }),
        true
      )
    )
    expect(mocks.state.openModal).not.toHaveBeenCalled()
    // Nothing asked first, so the toast says the work is kept and offers Undo.
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledOnce())
    const [title, options] = vi.mocked(toast.success).mock.calls[0]
    expect(title).toBe('Archived wt-dirty')
    expect(options?.description).toContain('uncommitted changes are kept')
    const list = vi.fn(async () => [{ id: 'wt-dirty' }])
    vi.stubGlobal('window', { api: { revioArchive: { list } } })
    const action = options?.action
    if (action && typeof action === 'object' && 'onClick' in action) {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler ignores its event
      action.onClick({} as never)
    }
    await vi.waitFor(() =>
      expect(archive.unarchive).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'wt-dirty' }),
        undefined,
        // Undo ends in the workspace it brought back, not on the view archiving left behind.
        expect.any(Function)
      )
    )
    vi.unstubAllGlobals()
  })

  it('does not speak of uncommitted changes when the archived workspace had none', async () => {
    setWorktrees([{ id: 'wt-tidy' }])
    vi.mocked(toast.success).mockClear()
    uncommittedCount.mockResolvedValueOnce(0)
    archive.keep.mockReturnValueOnce(Promise.resolve('archive-2'))
    archive.withoutAsking.mockReturnValueOnce(true)
    runWorktreeDelete('wt-tidy')
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledOnce())
    const [title, options] = vi.mocked(toast.success).mock.calls[0]
    expect(title).toBe('Archived wt-tidy')
    expect(options?.description).toBe('Unarchive it from Home to get it back.')
    // Undo is offered all the same.
    expect(options?.action).toBeTruthy()
  })

  it('archives a clean workspace without a kept-changes toast', async () => {
    setWorktrees([{ id: 'wt-clean' }])
    vi.mocked(toast.success).mockClear()
    archive.keep.mockReturnValueOnce(Promise.resolve(null))
    archive.withoutAsking.mockReturnValueOnce(true)
    runWorktreeDelete('wt-clean')
    await vi.waitFor(() => expect(mocks.state.removeWorktree).toHaveBeenCalled())
    await Promise.resolve()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('keeps the normal refusal when the checkpoint did not save', async () => {
    setWorktrees([{ id: 'wt-dirty' }])
    archive.keep.mockReturnValueOnce(Promise.resolve(null))
    archive.withoutAsking.mockReturnValueOnce(true)
    runWorktreeDelete('wt-dirty')
    await vi.waitFor(() =>
      expect(mocks.state.removeWorktree).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'wt-dirty' }),
        false
      )
    )
  })
})
