// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { WorkspaceSetupFinishStep } from './WorkspaceSetupFinishStep'

afterEach(cleanup)

it('says a project was added, and the connections are connected', () => {
  render(
    <WorkspaceSetupFinishStep
      summary={[
        { id: 'agent', mark: 'done' },
        { id: 'project', mark: 'done' },
        { id: 'github', mark: 'later' }
      ]}
      onOpenStep={vi.fn()}
    />
  )
  const rows = screen.getAllByRole('listitem').map((row) => row.textContent)
  expect(rows[0]).toBe('ClaudeConnected')
  expect(rows[1]).toBe('ProjectAdded')
  expect(rows[2]).toContain('Set up later in Settings')
})
