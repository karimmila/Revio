import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = { activeView: 'terminal', closeAutomationsPage: vi.fn(), closeTaskPage: vi.fn() }
vi.mock('@/store', () => ({ useAppStore: { getState: () => state } }))

import { leaveHiddenViewInRevio } from './revio-hidden-views-fallback'

describe('leaveHiddenViewInRevio', () => {
  beforeEach(() => vi.clearAllMocks())

  it('leaves the automations view for the view before it', () => {
    state.activeView = 'automations'
    leaveHiddenViewInRevio()
    expect(state.closeAutomationsPage).toHaveBeenCalledOnce()
    expect(state.closeTaskPage).not.toHaveBeenCalled()
  })

  it('leaves the task board for the view before it', () => {
    state.activeView = 'tasks'
    leaveHiddenViewInRevio()
    expect(state.closeTaskPage).toHaveBeenCalledOnce()
    expect(state.closeAutomationsPage).not.toHaveBeenCalled()
  })

  it('leaves every other view alone', () => {
    state.activeView = 'settings'
    leaveHiddenViewInRevio()
    expect(state.closeAutomationsPage).not.toHaveBeenCalled()
    expect(state.closeTaskPage).not.toHaveBeenCalled()
  })
})
