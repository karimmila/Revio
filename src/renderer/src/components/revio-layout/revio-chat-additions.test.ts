import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({ activeWorktreeId: 'wt' }) } }))

import type { PRComment } from '../../../../shared/github/comment-types'
import {
  addPRCommentsToActiveChat,
  addPRCommentsToChat,
  chatAdditions,
  clearChatAdditions,
  formatPRCommentForChat,
  isChatAdditionId,
  removeChatAddition
} from './revio-chat-additions'

function comment(id: number, extra: Partial<PRComment> = {}): PRComment {
  return {
    id,
    author: 'ana',
    authorAvatarUrl: '',
    body: `body ${id}`,
    createdAt: '2026-11-09T00:00:00Z',
    url: '',
    ...extra
  }
}

afterEach(() => clearChatAdditions('wt'))

describe('Chat additions', () => {
  it('formats a thread with its location and replies', () => {
    const text = formatPRCommentForChat({
      kind: 'thread',
      threadId: 't',
      root: comment(1, { path: 'src/a.ts', line: 7 }),
      replies: [comment(2, { author: 'bo' })]
    })
    expect(text).toBe('Pull request comment on src/a.ts:7:\nana: body 1\nbo: body 2')
  })

  it('adds each comment once and removes it again', () => {
    addPRCommentsToChat('wt', [{ kind: 'standalone', comment: comment(3) }])
    addPRCommentsToActiveChat([{ kind: 'standalone', comment: comment(3) }])
    const items = chatAdditions('wt')
    expect(items).toHaveLength(1)
    expect(isChatAdditionId(items[0].id)).toBe(true)
    expect(items[0].prompt).toContain('the pull request')
    removeChatAddition(items[0].id)
    expect(chatAdditions('wt')).toHaveLength(0)
  })

  it('keeps workspaces apart', () => {
    addPRCommentsToChat('other', [{ kind: 'standalone', comment: comment(4) }])
    expect(chatAdditions('wt')).toHaveLength(0)
    expect(chatAdditions('other')).toHaveLength(1)
    clearChatAdditions('other')
  })
})
