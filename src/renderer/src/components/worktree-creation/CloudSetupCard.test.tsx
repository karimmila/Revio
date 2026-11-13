// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { VERCEL_CLOUD_RECIPE_ID } from '../../../../shared/cloud/cloud-recipe'
import type { CloudSetupEntry } from '@/lib/workspace/creation/cloud-setup-steps'
import { CloudSetupCard } from './CloudSetupCard'

afterEach(cleanup)

const T0 = 1_000_000
const LOG =
  'Starting a sandbox from the build of 40b96a1\n[cloud] create sandbox from snapshot: 2.2 s\n'

function entry(status: CloudSetupEntry['status']): CloudSetupEntry {
  return {
    status,
    phase: 'provisioning-vm',
    startedAt: T0,
    phaseLog: [{ phase: 'provisioning-vm', at: T0 }],
    provisioningLog: LOG,
    request: {
      repoId: 'repo',
      name: 'squid',
      branchNameOverride: 'create-rotation-check',
      setupDecision: 'inherit',
      agent: null,
      pendingFirstAgentMessageRename: false,
      note: '',
      startupPlan: null,
      quickPrompt: '',
      quickTelemetry: null,
      ephemeralVmRecipe: { sourceRepoId: 'repo', recipeId: VERCEL_CLOUD_RECIPE_ID, projectId: 'p' }
    }
  }
}

function renderCard(status: CloudSetupEntry['status']) {
  const handlers = { onCancel: vi.fn(), onRetry: vi.fn(), onDismiss: vi.fn() }
  render(
    <CloudSetupCard
      entry={entry(status)}
      now={T0 + 8000}
      error={status === 'error' ? 'SSH failed: connection refused' : null}
      {...handlers}
    />
  )
  return handlers
}

it('shows the checklist with logs collapsed and a quiet Cancel while setting up', () => {
  const { onCancel } = renderCard('creating')
  expect(screen.getByRole('heading').textContent).toBe('Setting up your cloud workspace')
  expect(screen.getByText('squid · create-rotation-check')).toBeTruthy()
  expect(within(screen.getByRole('list')).getByText('Started machine from snapshot')).toBeTruthy()
  expect(within(screen.getByRole('list')).getByText('Connecting securely')).toBeTruthy()
  expect(screen.queryByText(/create sandbox from snapshot/)).toBeNull()
  // The running step shows the newest log line, so a long step still visibly moves.
  expect(document.querySelector('[data-cloud-setup-step-detail]')?.textContent).toMatch(/\S/)
  const toggle = screen.getByRole('button', { name: 'Show logs' })
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(toggle)
  // The internal "[cloud] " prefix is gone from the visible log.
  expect(screen.getByText(/^Starting a sandbox/, { selector: 'pre' }).textContent).toContain(
    '\ncreate sandbox from snapshot: 2.2 s'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onCancel).toHaveBeenCalledOnce()
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
})

it('marks the failed step, opens the logs and offers Retry and Dismiss on failure', () => {
  const { onRetry, onDismiss } = renderCard('error')
  expect(screen.getByRole('heading').textContent).toBe('Couldn’t set up your cloud workspace')
  expect(within(screen.getByRole('list')).getByText('Couldn’t connect')).toBeTruthy()
  expect(screen.getByText('SSH failed: connection refused')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Hide logs' }).getAttribute('aria-expanded')).toBe(
    'true'
  )
  expect(screen.getByRole('button', { name: 'Copy logs' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  expect(onRetry).toHaveBeenCalledOnce()
  expect(onDismiss).toHaveBeenCalledOnce()
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
})
