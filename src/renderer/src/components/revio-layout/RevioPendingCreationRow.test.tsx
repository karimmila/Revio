// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { useAppStore } from '@/store'
import type {
  PendingWorktreeCreation,
  WorktreeCreationRequest
} from '@/lib/workspace/creation/pending-worktree-creation'
import { RevioPendingCreationRow } from './RevioPendingCreationRow'

const initialState = useAppStore.getState()

const request: WorktreeCreationRequest = {
  repoId: 'repo',
  name: 'squid',
  displayName: 'Fix flaky test',
  setupDecision: 'inherit',
  agent: 'claude',
  pendingFirstAgentMessageRename: false,
  note: '',
  startupPlan: null,
  quickPrompt: '',
  quickTelemetry: null
}

function creation(patch: Partial<PendingWorktreeCreation> = {}): PendingWorktreeCreation {
  const entry: PendingWorktreeCreation = {
    creationId: 'c1',
    phase: 'provisioning-vm',
    status: 'creating',
    startedAt: 1,
    indeterminate: true,
    loaderVisible: false,
    request,
    ...patch
  }
  useAppStore.setState({ pendingWorktreeCreations: { c1: entry } })
  return entry
}

afterEach(() => {
  cleanup()
  useAppStore.setState(initialState, true)
})

it('is one workspace line: spinner, name and cloud mark, with the state only in its label', () => {
  render(<RevioPendingCreationRow entry={creation()} cloud />)
  const row = screen.getByRole('button')
  expect(row.textContent).toBe('Fix flaky test')
  expect(row.getAttribute('title')).toBe('Setting up…')
  expect(row.getAttribute('aria-label')).toBe('Fix flaky test, Setting up…')
  expect(row.hasAttribute('data-worktree-card-surface')).toBe(true)
  expect(row.querySelector('[data-worktree-card-parent-content]')?.className).toContain('h-[22px]')
  expect(row.querySelector('[data-revio-pending-glyph="setting-up"]')).toBeTruthy()
  expect(screen.getByLabelText('Cloud workspace')).toBeTruthy()
  expect(row.className).not.toContain('border-sidebar-ring')
})

it('shows a warning glyph and the reason on hover once setup failed', () => {
  const entry = creation({ status: 'error', error: 'Sandbox quota reached\nstack…' })
  render(<RevioPendingCreationRow entry={entry} cloud={false} />)
  const row = screen.getByRole('button')
  expect(row.querySelector('[data-revio-pending-glyph="failed"]')).toBeTruthy()
  expect(row.getAttribute('title')).toBe('Setup failed: Sandbox quota reached')
  expect(screen.queryByLabelText('Cloud workspace')).toBeNull()
})

it('opens the creation and then reads as the selected row', () => {
  useAppStore.setState({ activeView: 'terminal' })
  const entry = creation()
  const view = render(<RevioPendingCreationRow entry={entry} cloud />)
  expect(screen.getByRole('button').getAttribute('data-worktree-card-active')).toBeNull()

  fireEvent.click(screen.getByRole('button'))
  const state = useAppStore.getState()
  expect(state.activePendingCreationId).toBe('c1')
  expect(state.pendingWorktreeCreations.c1?.loaderVisible).toBe(true)
  view.rerender(<RevioPendingCreationRow entry={state.pendingWorktreeCreations.c1!} cloud />)
  expect(screen.getByRole('button').getAttribute('data-worktree-card-active')).toBe('primary')
})
