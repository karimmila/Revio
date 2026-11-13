import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  target: vi.fn(() => ({ kind: 'local' }) as const),
  lifecycle: vi.fn((): string | null => 'running'),
  toastError: vi.fn(),
  tabs: [{ id: 't1', contentType: 'agent-session', entityId: 's1', worktreeId: 'w1' }]
}))
vi.mock('@/components/native-chat/structured-agent-session-message-sender', () => ({
  sendStructuredAgentSessionMessage: mocks.send
}))
vi.mock('@/runtime/structured-agent-session-owner', () => ({
  structuredAgentSessionTargetForTab: mocks.target
}))
vi.mock('@/lib/agent-session/launch/structured-agent-session-launch-registry', () => ({
  getStructuredAgentSessionLaunchLifecycle: mocks.lifecycle
}))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('@/store/index', () => ({
  useAppStore: {
    getState: () => ({
      unifiedTabsByWorktree: { w1: mocks.tabs },
      getTab: (id: string) => mocks.tabs.find((tab) => tab.id === id) ?? null
    })
  }
}))

import { deliverPendingChatQueue, queuePendingChatMessages } from './pending-chat-queue-delivery'

const sent = (outcome: string) => ({ clientMessageId: 'm', outcome: Promise.resolve(outcome) })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  mocks.lifecycle.mockImplementation(() => 'running')
})

it('sends the queue in order after the first message, as queued follow-ups', async () => {
  let settleFirst = (): void => {}
  const first = new Promise<void>((resolve) => (settleFirst = resolve))
  mocks.send.mockImplementation(() => sent('recorded'))
  const done = deliverPendingChatQueue({
    worktreeId: 'w1',
    sessionId: 's1',
    messages: [{ text: 'one' }, { text: 'two', skills: [{ name: 'x', path: '/x' }] }],
    firstMessageSettled: first
  })
  await vi.advanceTimersByTimeAsync(1000)
  expect(mocks.send).not.toHaveBeenCalled()

  settleFirst()
  await expect(done).resolves.toBe(2)
  expect(mocks.send.mock.calls.map(([input]) => [input.text, input.delivery])).toEqual([
    ['one', 'queue-if-active'],
    ['two', 'queue-if-active']
  ])
  expect(mocks.send.mock.calls[1]?.[0].skills).toEqual([{ name: 'x', path: '/x' }])
  expect(mocks.toastError).not.toHaveBeenCalled()
})

it('waits while the chat is still opening or its send slot is taken', async () => {
  mocks.lifecycle.mockImplementationOnce(() => 'pending')
  mocks.send.mockImplementationOnce(() => null).mockImplementation(() => sent('recorded'))
  const done = deliverPendingChatQueue({
    worktreeId: 'w1',
    sessionId: 's1',
    messages: [{ text: 'a' }]
  })
  await vi.advanceTimersByTimeAsync(2000)
  await expect(done).resolves.toBe(1)
  expect(mocks.send).toHaveBeenCalledTimes(2)
})

it('stops at a returned message and names the ones after it', async () => {
  mocks.send.mockImplementationOnce(() => sent('returned'))
  const done = deliverPendingChatQueue({
    worktreeId: 'w1',
    sessionId: 's1',
    messages: [{ text: 'back in the composer' }, { text: 'never sent' }]
  })
  await expect(done).resolves.toBe(0)
  expect(mocks.send).toHaveBeenCalledTimes(1)
  expect(mocks.toastError).toHaveBeenCalledWith(expect.any(String), { description: 'never sent' })
})

it('starts only for a chat tab with a queue', async () => {
  mocks.send.mockImplementation(() => sent('recorded'))
  queuePendingChatMessages('w1', 't1', { queuedChatMessages: [] }, undefined)
  queuePendingChatMessages('w1', null, { queuedChatMessages: [{ text: 'a' }] }, undefined)
  expect(mocks.send).not.toHaveBeenCalled()
  queuePendingChatMessages('w1', 't1', { queuedChatMessages: [{ text: 'a' }] }, undefined)
  await vi.advanceTimersByTimeAsync(0)
  expect(mocks.send).toHaveBeenCalledTimes(1)
})
