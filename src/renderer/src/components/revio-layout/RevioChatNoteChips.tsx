import React from 'react'
import { useAppStore } from '@/store'
import { RevioNoteChips, useChatNotes } from './revio-note-chips'
import { registerRevioChatNotes } from './revio-chat-notes-registry'
import { revioLayoutActive } from './revio-root-flags'

const SESSION_SCOPE_PREFIX = 'agent-session:'

/** The workspace that holds this chat, found from its draft scope (`agent-session:<id>`). */
function useChatWorktreeId(draftScopeKey: string): string | null {
  const sessionId = draftScopeKey.startsWith(SESSION_SCOPE_PREFIX)
    ? draftScopeKey.slice(SESSION_SCOPE_PREFIX.length)
    : null
  return useAppStore((s) => {
    if (!sessionId) {
      return null
    }
    for (const [worktreeId, tabs] of Object.entries(s.unifiedTabsByWorktree)) {
      if (tabs.some((tab) => tab.contentType === 'agent-session' && tab.entityId === sessionId)) {
        return worktreeId
      }
    }
    return null
  })
}

/** The workspace's line notes show in the chat composer and go out with the message.
 *  Gated on the root flag so the composer reads no store state outside the layout. */
export function RevioChatNoteChips({
  draftScopeKey
}: {
  draftScopeKey: string
}): React.JSX.Element | null {
  return revioLayoutActive() ? <ChatNoteChips draftScopeKey={draftScopeKey} /> : null
}

function ChatNoteChips({ draftScopeKey }: { draftScopeKey: string }): React.JSX.Element | null {
  const worktreeId = useChatWorktreeId(draftScopeKey)
  const chatNotes = useChatNotes(worktreeId)
  const latest = React.useRef(chatNotes)
  latest.current = chatNotes
  React.useEffect(
    () =>
      worktreeId
        ? registerRevioChatNotes(draftScopeKey, {
            prefix: () => latest.current.prefix(),
            delivered: () => latest.current.markDelivered()
          })
        : undefined,
    [draftScopeKey, worktreeId]
  )
  if (chatNotes.notes.length === 0) {
    return null
  }
  return (
    <div data-revio-chat-note-chips="">
      <RevioNoteChips notes={chatNotes.notes} />
    </div>
  )
}
