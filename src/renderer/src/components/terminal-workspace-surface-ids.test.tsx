// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'

import { useAppStore } from '@/store'

import { useTerminalWorkspaceFoundation } from './use-terminal-workspace-foundation'
import type { FolderWorkspace } from '../../../shared/folder-workspaces/folder-workspace-types'
import type { Worktree } from '../../../shared/worktree/types'

function worktree(name: string): Worktree {
  return {
    id: `repo-1::/ws/${name}`,
    repoId: 'repo-1',
    path: `/ws/${name}`,
    head: 'abc123',
    branch: `refs/heads/${name}`,
    isBare: false,
    isMainWorktree: false,
    displayName: name,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    hostId: 'local'
  }
}

const initialState = useAppStore.getInitialState()

describe('workspace surface ids', () => {
  beforeEach(() => {
    useAppStore.setState(initialState, true)
  })

  afterEach(() => {
    cleanup()
    useAppStore.setState(initialState, true)
    vi.restoreAllMocks()
  })

  it('still re-projects when the active folder workspace owns the collision tie-break', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const localFolder: FolderWorkspace = {
      id: 'folder-shared',
      projectGroupId: 'group-shared',
      name: 'orca',
      folderPath: '/work/orca-local',
      connectionId: null,
      executionHostId: 'local',
      linkedTask: null,
      comment: '',
      isArchived: false,
      isUnread: false,
      isPinned: false,
      sortOrder: 0,
      lastActivityAt: 1,
      createdAt: 1,
      updatedAt: 1
    }
    const runtimeFolder: FolderWorkspace = {
      ...localFolder,
      folderPath: '/remote/orca',
      executionHostId: 'runtime:env-1'
    }
    useAppStore.setState({
      folderWorkspaces: [localFolder, runtimeFolder],
      activeWorktreeId: 'folder:folder-shared',
      activeWorkspaceExecutionHostId: 'runtime:env-1'
    })

    const { result } = renderHook(() => useTerminalWorkspaceFoundation())
    expect(result.current.workspaceSurfaces).toEqual([
      { id: 'folder:folder-shared', path: '/remote/orca' }
    ])

    // Leaving folder scope must drop its host tie-break and recompute first-wins selection.
    act(() => {
      useAppStore.setState({
        activeWorktreeId: 'repo-1::/worktree-0',
        activeWorkspaceExecutionHostId: null
      })
    })
    expect(result.current.workspaceSurfaces).toEqual([
      { id: 'folder:folder-shared', path: '/work/orca-local' }
    ])
    warn.mockRestore()
  })

  it('never moves a mounted surface when a new workspace sorts first', () => {
    // A moved surface's effects are disconnected and reconnected under StrictMode, which crashed a
    // retained Monaco diff when "Add a newsletter signup form" was created.
    const older = [worktree('cart-total-tests'), worktree('dark-mode-toggle')]
    useAppStore.setState({ worktreesByRepo: { 'repo-1': older } })
    const { result } = renderHook(() => useTerminalWorkspaceFoundation())
    expect(result.current.workspaceSurfaceIds).toEqual([
      'repo-1::/ws/cart-total-tests',
      'repo-1::/ws/dark-mode-toggle'
    ])

    act(() => {
      useAppStore.setState({
        worktreesByRepo: { 'repo-1': [worktree('add-a-newsletter-signup-form'), ...older] }
      })
    })
    expect(result.current.workspaceSurfaceIds).toEqual([
      'repo-1::/ws/cart-total-tests',
      'repo-1::/ws/dark-mode-toggle',
      'repo-1::/ws/add-a-newsletter-signup-form'
    ])
  })
})
