// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NativeChatPastChats } from './NativeChatPastChats'
import { pastChatAttachmentText, pastChatsForWorkspace } from './native-chat-past-chats'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function session(id: string, cwd: string, modifiedAt: string, messageCount = 4) {
  return {
    id,
    cwd,
    modifiedAt,
    messageCount,
    title: `Chat ${id}`,
    filePath: `/t/${id}.jsonl`
  }
}

it("keeps this workspace's newest past chats with messages", () => {
  const sessions = [
    session('a', '/w', '2026-11-01'),
    session('b', '/w', '2026-11-03'),
    session('c', '/other', '2026-11-04'),
    session('d', '/w', '2026-11-05', 0)
  ]
  expect(pastChatsForWorkspace(sessions, '/w').map((s) => s.id)).toEqual(['b', 'a'])
  expect(pastChatAttachmentText({ title: 'Fix', filePath: '/t/x.jsonl' })).toBe(
    'Earlier chat "Fix" — transcript: /t/x.jsonl '
  )
})

it('offers them under "Add chat transcripts:" and hands a pick its words', async () => {
  vi.stubGlobal('api', {
    aiVault: { listSessions: vi.fn(async () => ({ sessions: [session('a', '/w', '2026-11-01')] })) }
  })
  const onPick = vi.fn()
  render(<NativeChatPastChats workspacePath="/w" onPick={onPick} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Chat a' }))
  expect(screen.getByText('Add chat transcripts:')).toBeTruthy()
  expect(onPick).toHaveBeenCalledWith(
    expect.anything(),
    'Earlier chat "Chat a" — transcript: /t/a.jsonl '
  )
})
