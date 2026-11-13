import React from 'react'
import { Clock } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { NativeChatUserMessageRow } from '@/components/native-chat/NativeChatUserMessageRow'
import type { NativeChatMessage } from '../../../../shared/native-chat/native-chat-types'
import { deriveNativeChatRowContent } from '../../../../shared/native-chat/transcript/native-chat-row-content'
import type { AgentJournalSkillRef } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import {
  pendingCreationChatDraftScopeKey,
  type PendingChatQueuedMessage,
  type PendingWorktreeCreation
} from '@/lib/workspace/creation/pending-worktree-creation'

/**
 * Takes a message sent after the first one while the worktree is created; the chat sends it once
 * it opens (pending-chat-queue-delivery). Images need the chat's own upload, so a message with
 * attachments waits in the composer instead, with a line saying why.
 */
export function queuePendingChatMessage(
  creationId: string,
  current: Pick<PendingWorktreeCreation, 'queuedChatMessages'>,
  text: string,
  attachments: readonly unknown[],
  skills: readonly AgentJournalSkillRef[] | undefined,
  onError: (message: string | null) => void
): boolean {
  if (attachments.length > 0) {
    onError(
      translate(
        'auto.components.worktree.creation.PendingChatQueuedMessages.noImages',
        'Images can be sent once the workspace is ready.'
      )
    )
    return false
  }
  const message: PendingChatQueuedMessage = { text, ...(skills?.length ? { skills } : {}) }
  useAppStore.getState().updatePendingWorktreeCreation(creationId, {
    queuedChatMessages: [...(current.queuedChatMessages ?? []), message]
  })
  return true
}

function QueuedMessageRow({ id, text }: { id: string; text: string }): React.JSX.Element {
  const rowRef = React.useRef<HTMLDivElement | null>(null)
  const message = React.useMemo(
    (): NativeChatMessage => ({
      id,
      role: 'user',
      blocks: [{ type: 'text', text }],
      timestamp: null,
      source: 'transcript'
    }),
    [id, text]
  )
  const { markdown, prose } = deriveNativeChatRowContent(message.blocks)
  return (
    <div data-pending-chat-queued="">
      <NativeChatUserMessageRow
        message={message}
        markdown={markdown}
        prose={prose}
        rowRef={rowRef}
        onRefolded={() => {}}
      />
      <div className="-mt-1 mb-2 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
        <Clock className="size-3" />
        {translate(
          'auto.components.worktree.creation.PendingChatQueuedMessages.queued',
          'Queued — sends when the workspace is ready'
        )}
      </div>
    </div>
  )
}

/** The messages queued while the worktree is created, in the order they will be sent. */
export function PendingChatQueuedMessages({
  creationId,
  messages
}: {
  creationId: string
  messages: readonly PendingChatQueuedMessage[] | undefined
}): React.JSX.Element | null {
  if (!messages?.length) {
    return null
  }
  const scope = pendingCreationChatDraftScopeKey(creationId)
  return (
    <>
      {messages.map((message, index) => (
        <QueuedMessageRow
          // Queued messages are only appended, so the position names one for good.
          key={index}
          id={`${scope}:queued-${index}`}
          text={message.text}
        />
      ))}
    </>
  )
}
