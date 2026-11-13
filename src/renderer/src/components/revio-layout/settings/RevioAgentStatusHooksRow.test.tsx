// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  settings: { agentStatusHooksEnabled: false },
  updateSettings: vi.fn(async (updates: { agentStatusHooksEnabled?: boolean }) => {
    Object.assign(state.settings, updates)
  })
}))
vi.mock('@/store', () => ({
  useAppStore: (select: (store: typeof state) => unknown) => select(state)
}))

import { RevioAgentStatusHooksRow } from './RevioAgentStatusHooksRow'

let hookFiles: string[] = []
let available = true

beforeEach(() => {
  state.settings.agentStatusHooksEnabled = false
  state.updateSettings.mockClear()
  hookFiles = []
  available = true
  vi.stubGlobal('api', {
    agentStatus: {
      listManagedHookFiles: async () => hookFiles,
      statusHooksAvailable: async () => available
    }
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('is off and names no file until the person turns it on', async () => {
  render(<RevioAgentStatusHooksRow />)

  expect((await screen.findByRole('switch')).getAttribute('aria-checked')).toBe('false')
  expect(screen.queryByText(/Hooks are written in/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Remove hooks' })).toBeNull()
  expect(state.updateSettings).not.toHaveBeenCalled()
})

it('names every file that holds hooks and removes them on request', async () => {
  state.settings.agentStatusHooksEnabled = true
  hookFiles = ['/Users/me/.claude/settings.json', '/Users/me/.codex/hooks.json']
  render(<RevioAgentStatusHooksRow />)

  await screen.findByText(
    'Hooks are written in: /Users/me/.claude/settings.json, /Users/me/.codex/hooks.json'
  )
  hookFiles = []
  fireEvent.click(screen.getByRole('button', { name: 'Remove hooks' }))

  await waitFor(() =>
    expect(state.updateSettings).toHaveBeenCalledWith({ agentStatusHooksEnabled: false })
  )
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove hooks' })).toBeNull())
})

it('shows no switch and no Remove in a build that does not manage hooks', async () => {
  available = false
  state.settings.agentStatusHooksEnabled = true
  hookFiles = ['/Users/me/.claude/settings.json']
  const { container } = render(<RevioAgentStatusHooksRow />)

  await waitFor(() => expect(container.innerHTML).toBe(''))
  expect(screen.queryByRole('switch')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Remove hooks' })).toBeNull()
})

it('stays hidden when main does not answer the availability question', async () => {
  vi.stubGlobal('api', { agentStatus: { listManagedHookFiles: async () => hookFiles } })
  const { container } = render(<RevioAgentStatusHooksRow />)

  await Promise.resolve()
  expect(container.innerHTML).toBe('')
})
