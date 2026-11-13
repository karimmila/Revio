// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NativeChatWorkingStatus, revioFoldLabel } from './NativeChatWorkingStatus'
import { nativeChatTurnFoldSummaries } from '../../../../shared/native-chat/transcript/native-chat-turn-fold-summary'

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.revioLayout
})

it('words the fold', () => {
  expect(revioFoldLabel({ toolCalls: 12, messages: 3 }, false)).toBe(
    'Expand 12 tool calls, 3 messages'
  )
  expect(revioFoldLabel({ toolCalls: 1, messages: 0 }, true)).toBe('Collapse 1 tool call')
  expect(revioFoldLabel({ toolCalls: 0, messages: 0 }, false)).toBeNull()
})

it('counts the tool calls and prose rows a turn folds', () => {
  const call = { type: 'tool-call' as const, name: 'Bash', input: {} }
  const summaries = nativeChatTurnFoldSummaries(
    [{ blocks: [call, call] }, { blocks: [{ type: 'text', text: 'Looking' }] }],
    [
      { turnKey: 't', rendersProse: false },
      { turnKey: 't', rendersProse: true }
    ],
    new Set([0, 1])
  )
  expect(summaries.get('t')).toEqual({ toolCalls: 2, messages: 1 })
})

it('the settled toggle reads the summary in the workspace layout', () => {
  document.documentElement.dataset.revioLayout = 'true'
  render(
    <NativeChatWorkingStatus
      startedAt={0}
      workedSeconds={65}
      foldSummary={{ toolCalls: 4, messages: 2 }}
      onToggleExpanded={vi.fn()}
    />
  )
  expect(screen.getByRole('button').textContent).toContain('Expand 4 tool calls, 2 messages')
})
