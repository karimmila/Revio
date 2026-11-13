// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { forwardRef } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import type { NativeChatComposerProps } from '@/components/native-chat/native-chat-composer-types'
import type {
  PendingWorktreeCreation,
  WorktreeCreationRequest
} from '@/lib/workspace/creation/pending-worktree-creation'
import PendingNativeChatCreation from './PendingNativeChatCreation'

const retry = vi.hoisted(() => vi.fn())
vi.mock('@/lib/workspace/creation/worktree-creation-flow', () => ({
  retryBackgroundWorktreeCreation: retry
}))
const composer = vi.hoisted((): { props: NativeChatComposerProps | null } => ({ props: null }))
vi.mock('@/components/native-chat/NativeChatComposer', () => ({
  NativeChatComposer: forwardRef<unknown, NativeChatComposerProps>((props, _ref) => {
    composer.props = props
    return null
  })
}))
vi.mock('./use-pending-native-chat-options', () => ({
  usePendingNativeChatOptions: () => ({ surface: {}, snapshot: [] })
}))
vi.mock('@/components/native-chat/NativeChatEmptyState', () => ({
  NativeChatEmptyState: () => <p>empty chat</p>
}))
vi.mock('@/components/native-chat/NativeChatUserMessageRow', () => ({
  NativeChatUserMessageRow: ({ markdown }: { markdown: string }) => <p>{markdown}</p>
}))
vi.mock('./WorktreeCreationTabStrip', () => ({ default: () => null }))

const initialState = useAppStore.getState()
const T0 = 1_000_000

const request: WorktreeCreationRequest = {
  repoId: 'repo',
  name: 'squid',
  setupDecision: 'inherit',
  agent: 'claude',
  agentLaunchRoute: 'structured-native-chat',
  pendingFirstAgentMessageRename: false,
  note: '',
  startupPlan: null,
  quickPrompt: '',
  quickTelemetry: null,
  suppressTerminalFocusOnCompletion: true,
  simpleCloudSetup: true,
  ephemeralVmRecipe: { sourceRepoId: 'repo', recipeId: 'vercel', projectId: 'p' }
}

function setCreation(patch: Partial<PendingWorktreeCreation> = {}): void {
  useAppStore.setState({
    pendingWorktreeCreations: {
      creation: {
        creationId: 'creation',
        phase: 'provisioning-vm',
        status: 'creating',
        startedAt: T0,
        indeterminate: true,
        loaderVisible: true,
        request,
        ...patch
      }
    }
  })
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  composer.props = null
  retry.mockReset()
  useAppStore.setState(initialState, true)
})

it('shows the prompt and one loading line while the cloud workspace is set up', () => {
  vi.useFakeTimers({ now: T0 + 4000 })
  setCreation({
    request: { ...request, quickPrompt: 'Fix the flaky test', promptDelivery: 'auto-submit' }
  })
  render(<PendingNativeChatCreation creationId="creation" />)

  expect(screen.getByText('Fix the flaky test')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('Setting up workspace…4s')
  expect(screen.queryByText('empty chat')).toBeNull()
  // The prompt already holds the first send; the composer still takes more, as queued messages.
  expect(composer.props?.structuredTransport?.sendBlockedReason).toBeUndefined()
})

it('queues more messages under the first one and keeps their order', () => {
  setCreation({
    request: { ...request, quickPrompt: 'Fix the flaky test', promptDelivery: 'auto-submit' }
  })
  render(<PendingNativeChatCreation creationId="creation" />)

  const sent: unknown[] = []
  act(() => {
    sent.push(composer.props?.structuredTransport?.send('Also add a test', []))
  })
  act(() => {
    sent.push(composer.props?.structuredTransport?.send('Then open a PR', []))
  })

  expect(sent).toEqual([true, true])
  const creation = useAppStore.getState().pendingWorktreeCreations.creation
  expect(creation?.heldChatMessage).toBeUndefined()
  expect(creation?.queuedChatMessages).toEqual([
    { text: 'Also add a test' },
    { text: 'Then open a PR' }
  ])
  const rows = [...document.querySelectorAll('[data-pending-chat-queued]')]
  expect(rows.map((row) => row.textContent)).toEqual([
    'Also add a testQueued — sends when the workspace is ready',
    'Then open a PRQueued — sends when the workspace is ready'
  ])
})

it('keeps a queued message with images in the composer, with a line saying why', () => {
  setCreation({
    request: { ...request, quickPrompt: 'Fix the flaky test', promptDelivery: 'auto-submit' }
  })
  render(<PendingNativeChatCreation creationId="creation" />)

  let accepted: unknown
  act(() => {
    accepted = composer.props?.structuredTransport?.send('See this', [
      { id: 'img', path: '/tmp/a.png' }
    ])
  })

  expect(accepted).toBe(false)
  expect(useAppStore.getState().pendingWorktreeCreations.creation?.queuedChatMessages).toBe(
    undefined
  )
  expect(composer.props?.notices?.[0]?.text).toBe('Images can be sent once the workspace is ready.')
})

it('queues a message typed during setup as the chat’s first message', () => {
  setCreation()
  render(<PendingNativeChatCreation creationId="creation" />)
  expect(composer.props?.structuredTransport?.sendBlockedReason).toBeUndefined()

  let accepted: unknown
  act(() => {
    accepted = composer.props?.structuredTransport?.send('Add a test', [])
  })

  expect(accepted).toBe(true)
  expect(useAppStore.getState().pendingWorktreeCreations.creation?.heldChatMessage).toBe(
    'Add a test'
  )
  expect(screen.getByText('Add a test')).toBeTruthy()
  expect(screen.getByRole('status')).toBeTruthy()
})

it('replaces the loading line with a short error, details on demand, and Retry', () => {
  setCreation({
    status: 'error',
    error: 'SSH failed: connection refused\n  at connect (ssh.ts:12)',
    provisioningLog: '[cloud] Starting a sandbox\n'
  })
  render(<PendingNativeChatCreation creationId="creation" />)

  expect(screen.queryByRole('status')).toBeNull()
  const alert = screen.getByRole('alert')
  expect(alert.textContent).toContain('Couldn’t set up the workspace.')
  expect(alert.textContent).toContain('SSH failed: connection refused')
  expect(alert.textContent).not.toContain('ssh.ts:12')
  expect(screen.queryByText('Starting a sandbox')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Show details' }))
  expect(screen.getByText('Starting a sandbox')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(retry).toHaveBeenCalledWith('creation')
})

it('goes away once the workspace is ready and the creation hands off', () => {
  setCreation()
  const view = render(<PendingNativeChatCreation creationId="creation" />)
  expect(screen.getByRole('status')).toBeTruthy()

  act(() => useAppStore.setState({ pendingWorktreeCreations: {} }))

  expect(view.container.textContent).toBe('')
})
