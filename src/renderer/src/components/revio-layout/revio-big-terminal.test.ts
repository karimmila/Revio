import { beforeEach, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => {
  const holder: { state: Record<string, unknown> } = { state: {} }
  return holder
})
vi.mock('@/store', () => ({ useAppStore: { getState: () => store.state } }))
const quick = vi.hoisted(() => ({ run: vi.fn(() => ({ tabId: 't' })) }))
vi.mock('@/lib/run-quick-command-in-new-tab', () => ({ runQuickCommandInNewTab: quick.run }))

import { bigTerminalModeOn, openRevioBigTerminal } from './revio-big-terminal'

const openTab = vi.fn(async () => {})
beforeEach(() => {
  quick.run.mockClear()
  openTab.mockClear()
  store.state = {
    settings: { revioLayout: true, revioBigTerminal: true },
    activeGroupIdByWorktree: { w: 'g1' },
    groupsByWorktree: {},
    openNewTerminalTabInActiveWorkspace: openTab
  }
})

it('is on only with the workspace layout and the experimental toggle', () => {
  expect(bigTerminalModeOn()).toBe(true)
  store.state = { settings: { revioLayout: true } }
  expect(bigTerminalModeOn()).toBe(false)
})

it('opens a center terminal, running the preset when one is set', () => {
  expect(openRevioBigTerminal('w')).toBe(true)
  expect(openTab).toHaveBeenCalledWith('g1')
  store.state = {
    ...store.state,
    settings: {
      revioLayout: true,
      revioBigTerminal: true,
      revioBigTerminalPreset: 'claude'
    }
  }
  expect(openRevioBigTerminal('w')).toBe(true)
  expect(quick.run).toHaveBeenCalledWith(
    expect.objectContaining({
      worktreeId: 'w',
      groupId: 'g1',
      command: expect.objectContaining({ command: 'claude', appendEnter: true })
    })
  )
})
