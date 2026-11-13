import { afterEach, expect, it } from 'vitest'
import { useAppStore } from '@/store'
import type { WorktreeCreationRequest } from '@/lib/workspace/creation/pending-worktree-creation'
import { adoptCreatedWorktree } from './ephemeral-vm-worktree-creation'

const initialState = useAppStore.getState()

const request: WorktreeCreationRequest = {
  repoId: 'repo',
  name: 'squid',
  setupDecision: 'inherit',
  agent: null,
  pendingFirstAgentMessageRename: false,
  note: '',
  startupPlan: null,
  quickPrompt: '',
  quickTelemetry: null
}

afterEach(() => {
  useAppStore.setState(initialState, true)
})

it('names the created worktree on the creation at once, so the sidebar can swap its row', async () => {
  useAppStore.setState({
    pendingWorktreeCreations: {
      c1: {
        creationId: 'c1',
        phase: 'creating',
        status: 'creating',
        startedAt: 1,
        indeterminate: true,
        loaderVisible: true,
        request
      }
    }
  })
  await expect(adoptCreatedWorktree('c1', request, 'repo::/w')).resolves.toBe(true)
  expect(useAppStore.getState().pendingWorktreeCreations.c1?.worktreeId).toBe('repo::/w')
})

it('adopts nothing for a creation cancelled while the worktree was created', async () => {
  useAppStore.setState({ pendingWorktreeCreations: {} })
  await expect(adoptCreatedWorktree('c1', request, 'repo::/w')).resolves.toBe(false)
})
