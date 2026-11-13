// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { useAppStore } from '@/store'
import WorktreeCreationPanel from '@/components/worktree-creation/WorktreeCreationPanel'
import { cloudRestoreRequest } from './revio-cloud-unarchive'

const initialState = useAppStore.getState()

afterEach(() => {
  cleanup()
  useAppStore.setState(initialState, true)
})

it('unarchives a cloud workspace under the one "Setting up workspace…" line of a cloud create', () => {
  const request = cloudRestoreRequest(
    { repoId: 'repo-1', displayName: 'Fix login' },
    'me/fix-login',
    'project-1',
    {}
  )
  expect(request.simpleCloudSetup).toBe(true)
  useAppStore.setState({
    pendingWorktreeCreations: {
      c1: {
        creationId: 'c1',
        phase: 'provisioning-vm',
        status: 'creating',
        startedAt: 1,
        indeterminate: true,
        loaderVisible: true,
        request
      }
    }
  })
  render(<WorktreeCreationPanel creationId="c1" />)
  expect(screen.getByText('Setting up workspace…')).toBeTruthy()
  // The recipe's step list is the old screen.
  expect(screen.queryByText('Setting up your cloud workspace')).toBeNull()
  expect(screen.queryByText('Started machine from snapshot')).toBeNull()
})
