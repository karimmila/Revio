// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NativeChatAgentSwitchRows, pickerSwitchAgents } from './NativeChatAgentSwitchRows'

const launch = vi.hoisted(() => vi.fn(() => ({})))
vi.mock('./native-chat-agent-switch-launch', () => ({ launchAgentSwitch: launch }))

afterEach(cleanup)

it('offers the other agents, each opening a new chat in the workspace', async () => {
  expect(pickerSwitchAgents('claude')).toEqual(['codex', 'opencode', 'cursor'])
  const onPicked = vi.fn()
  render(<NativeChatAgentSwitchRows agent="claude" onPicked={onPicked} />)
  expect(screen.queryByRole('button', { name: /^Claude/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /^Codex/ }))
  expect(onPicked).toHaveBeenCalledOnce()
  await waitFor(() => expect(launch).toHaveBeenCalledWith('codex'))
})
