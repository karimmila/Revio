// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import NativeChatLinkDirectoriesDialog from './NativeChatLinkDirectoriesDialog'

const call = vi.hoisted(() => vi.fn(async () => ({ requested: true })))
vi.mock('@/runtime/structured-agent-session-client', () => ({ callStructuredAgentSession: call }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function open(linked: Record<string, string[]>) {
  const updateSettings = vi.fn(async (patch: { revioLinkedDirectories?: unknown }) => {
    act(() =>
      useAppStore.setState((state) => ({
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test fixture; only the fields this test reads are set
        settings: { ...state.settings!, ...patch } as never
      }))
    )
  })
  const closeModal = vi.fn()
  useAppStore.setState({
    modalData: { sessionId: 's1', target: { kind: 'local' }, worktreeId: 'w1' },
    closeModal,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test fixture; only the fields this test reads are set
    updateSettings: updateSettings as never,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test fixture; only the fields this test reads are set
    settings: { revioLinkedDirectories: linked } as never,
    worktreesByRepo: {
      r: [
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test fixture; only the fields this test reads are set
        { id: 'w1', path: '/w', repoId: 'r', displayName: 'here' } as never,
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test fixture; only the fields this test reads are set
        { id: 'w2', path: '/other', repoId: 'r', displayName: 'other-ws' } as never
      ]
    }
  })
  render(<NativeChatLinkDirectoriesDialog />)
  return { updateSettings, closeModal }
}

it('links another workspace, and Done restarts the agent so it gets it', async () => {
  const { updateSettings, closeModal } = open({})
  fireEvent.click(screen.getByRole('checkbox', { name: /other-ws/ }))
  expect(updateSettings).toHaveBeenCalledWith({ revioLinkedDirectories: { '/w': ['/other'] } })
  expect(screen.getByRole('checkbox', { name: /other-ws/ }).getAttribute('aria-checked')).toBe(
    'true'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(closeModal).toHaveBeenCalled()
  expect(call).toHaveBeenCalledWith({ kind: 'local' }, 'agentSession.restartAgent', {
    sessionId: 's1'
  })
})

it('removes a linked folder; closing without a change restarts nothing', () => {
  const { updateSettings } = open({ '/w': ['/docs'] })
  expect(screen.getByText('/docs')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
  expect(updateSettings).toHaveBeenCalledWith({ revioLinkedDirectories: {} })
  cleanup()
  vi.clearAllMocks()
  open({})
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(call).not.toHaveBeenCalled()
})
