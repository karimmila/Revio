import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Tab = { id: string; contentType: 'agent-session' | 'terminal' }
type Entry = { paneKey: string; tabId?: string; state: 'working' | 'done' }
type State = {
  unifiedTabsByWorktree: Record<string, Tab[]>
  agentStatusByPaneKey: Record<string, Entry>
}
const store = vi.hoisted((): { state: State; listeners: Set<(state: unknown) => void> } => ({
  state: { unifiedTabsByWorktree: {}, agentStatusByPaneKey: {} },
  listeners: new Set()
}))
// A fixed clock: "just asked" is measured from when the chat was started.
const NOW = Date.UTC(2026, 10, 12, 12, 0, 0)
const activate = vi.hoisted(() => vi.fn(() => true))

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => store.state,
    subscribe: (listener: (state: unknown) => void) => {
      store.listeners.add(listener)
      return () => store.listeners.delete(listener)
    }
  }
}))
vi.mock('@/lib/agent-session/structured-agent-session-tab-activation', () => ({
  activateStructuredAgentSessionTab: activate
}))

import {
  createPrChatRunning,
  createPrChatTabId,
  resetCreatePrChatsForTest,
  showCreatePrChat,
  startCreatePrChat
} from './revio-create-pr-chat'

const W = 'repo::/w/add-subtract'
const chat = (id: string): Tab => ({ id, contentType: 'agent-session' })

function setTabs(tabs: Tab[]): void {
  store.state = { ...store.state, unifiedTabsByWorktree: { [W]: tabs } }
  for (const listener of store.listeners) {
    listener(store.state)
  }
}

beforeEach(() => {
  resetCreatePrChatsForTest()
  activate.mockClear()
  store.listeners.clear()
  store.state = { unifiedTabsByWorktree: { [W]: [chat('first')] }, agentStatusByPaneKey: {} }
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('the one Create PR chat of a workspace', () => {
  it('remembers the tab its launch opened and shows it on the next request', () => {
    expect(showCreatePrChat(W)).toBe(false)
    const launch = vi.fn(() => {
      setTabs([chat('first'), chat('pr')])
      return true
    })
    expect(startCreatePrChat(W, launch)).toBe(true)
    expect(createPrChatTabId(store.state, W)).toBe('pr')
    expect(showCreatePrChat(W)).toBe(true)
    expect(activate).toHaveBeenCalledWith({ worktreeId: W, tabId: 'pr' })
    expect(launch).toHaveBeenCalledOnce()
  })

  it('adopts a tab that opens after the launch returned, as a cloud chat does', () => {
    startCreatePrChat(W, () => true)
    expect(createPrChatTabId(store.state, W)).toBeNull()
    setTabs([chat('first'), chat('late')])
    expect(createPrChatTabId(store.state, W)).toBe('late')
  })

  it('forgets a chat whose tab was closed, and one that never started', () => {
    startCreatePrChat(W, () => {
      setTabs([chat('first'), chat('pr')])
      return true
    })
    setTabs([chat('first')])
    expect(showCreatePrChat(W)).toBe(false)
    resetCreatePrChatsForTest()
    expect(startCreatePrChat(W, () => false)).toBe(false)
    expect(createPrChatRunning(store.state, W, NOW)).toBe(false)
  })

  it('counts as running while its agent works, and for a moment before it reports', () => {
    const now = NOW
    startCreatePrChat(W, () => {
      setTabs([chat('first'), chat('pr')])
      return true
    })
    expect(createPrChatRunning(store.state, W, now + 1_000)).toBe(true)
    expect(createPrChatRunning(store.state, W, now + 60_000)).toBe(false)
    store.state = {
      ...store.state,
      agentStatusByPaneKey: { 'pr:leaf': { paneKey: 'pr:leaf', state: 'working' } }
    }
    expect(createPrChatRunning(store.state, W, now + 60_000)).toBe(true)
    store.state = {
      ...store.state,
      agentStatusByPaneKey: { 'pr:leaf': { paneKey: 'pr:leaf', state: 'done' } }
    }
    expect(createPrChatRunning(store.state, W, now + 1_000)).toBe(false)
  })
})
