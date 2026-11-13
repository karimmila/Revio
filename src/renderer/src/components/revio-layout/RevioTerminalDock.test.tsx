// @vitest-environment happy-dom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import type { PendingWorktreeCreation } from '@/lib/workspace/creation/pending-worktree-creation'
import { RevioTerminalDock, useRevioTerminalDockRect } from './RevioTerminalDock'

const dock = vi.hoisted(() => ({ create: vi.fn(() => 'tab-new'), nothingToShow: false }))
vi.mock('./RevioRunButton', () => ({
  RevioRunButton: () => <div data-testid="run-button" />
}))
vi.mock('./revio-dock-terminals', () => ({
  createDockTerminalForActiveWorkspace: dock.create,
  findDockTerminalForWorkspace: () => null,
  isDockTabForWorkspace: () => false,
  isRemoteWorkspace: () => false,
  openRevioDockTerminal: vi.fn()
}))

vi.mock('./revio-dock-visibility', () => ({
  dockHasNothingForWorkspace: () => dock.nothingToShow
}))

const initialState = useAppStore.getState()

const creation: PendingWorktreeCreation = {
  creationId: 'c1',
  phase: 'creating',
  status: 'creating',
  startedAt: 1,
  indeterminate: true,
  loaderVisible: true,
  request: {
    repoId: 'repo',
    name: 'new-one',
    setupDecision: 'inherit',
    agent: 'claude',
    pendingFirstAgentMessageRename: false,
    note: '',
    startupPlan: null,
    quickPrompt: '',
    quickTelemetry: null
  }
}

beforeEach(() => {
  dock.create.mockClear()
  dock.nothingToShow = false
  // The prior workspace stays active while the new one is set up.
  useAppStore.setState({
    activeView: 'terminal',
    activeWorktreeId: 'repo::/work/other',
    floatingWorkspacePanelOpen: true,
    activePendingCreationId: 'c1',
    pendingWorktreeCreations: { c1: creation }
  })
})

afterEach(() => {
  cleanup()
  useAppStore.setState(initialState, true)
})

it('shows an empty state, not the prior workspace terminal, while a workspace sets up', () => {
  const rect = renderHook(() => useRevioTerminalDockRect())
  render(<RevioTerminalDock />)
  expect(screen.getByText('Terminal is available when setup finishes')).toBeTruthy()
  // No rect: the floating terminal panel stays hidden, and no shell opens in the prior workspace.
  expect(rect.result.current).toBeNull()
  expect(dock.create).not.toHaveBeenCalled()
  // Run would start the prior workspace's action.
  expect(screen.queryByTestId('run-button')).toBeNull()
})

it('keeps the notice when the dock is folded', () => {
  useAppStore.setState({ floatingWorkspacePanelOpen: false })
  render(<RevioTerminalDock />)
  expect(screen.getByText('Terminal is available when setup finishes')).toBeTruthy()
  expect(screen.queryByLabelText('Show terminal')).toBeNull()
})

it('opens the new workspace terminal once setup hands off', () => {
  const rect = renderHook(() => useRevioTerminalDockRect())
  render(<RevioTerminalDock />)
  act(() => {
    useAppStore.setState({
      activePendingCreationId: null,
      pendingWorktreeCreations: {},
      activeWorktreeId: 'repo::/work/new-one'
    })
  })
  expect(screen.queryByText('Terminal is available when setup finishes')).toBeNull()
  expect(screen.getByTestId('run-button')).toBeTruthy()
  expect(dock.create).toHaveBeenCalledTimes(1)
  expect(rect.result.current).not.toBeNull()
})

it('folds for a cloud workspace with no Setup or Run tab, and keeps the saved open state', () => {
  dock.nothingToShow = true
  useAppStore.setState({ activePendingCreationId: null, pendingWorktreeCreations: {} })
  const rect = renderHook(() => useRevioTerminalDockRect())
  const view = render(<RevioTerminalDock />)
  expect(screen.getByLabelText('Show terminal')).toBeTruthy()
  expect(rect.result.current).toBeNull()
  expect(dock.create).not.toHaveBeenCalled()
  // Closing it here is what made the dock come back folded after a restart.
  expect(useAppStore.getState().floatingWorkspacePanelOpen).toBe(true)

  // Its tabs are restored a moment later: the dock is open again without a click.
  dock.nothingToShow = false
  act(() => {
    useAppStore.setState({ tabsByWorktree: { ...useAppStore.getState().tabsByWorktree } })
  })
  view.rerender(<RevioTerminalDock />)
  expect(screen.queryByLabelText('Show terminal')).toBeNull()
  expect(rect.result.current).not.toBeNull()
})
