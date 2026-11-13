import { agentMessageTranscriptText } from '../../../../shared/agent-session/agent-message-display-text'
import { nativeChatMessageCopyText } from '../../../../shared/native-chat/transcript/native-chat-message-copy-text'
import { nativeChatStoppedBeforeStartLabel } from './native-chat-stopped-before-start-row'
import type { NativeChatTranscriptSlot } from './native-chat-transcript-slots'

/** The copy text of the transcript row drawing `messageId`, or null when no row draws it. */
export function nativeChatSlotCopyText(
  slots: readonly NativeChatTranscriptSlot[],
  messageId: string
): string | null {
  const slot = slots.find((entry) => entry.kind === 'message' && entry.message.id === messageId)
  return slot?.kind === 'message'
    ? slot.message.from && (slot.message.role === 'user' || slot.message.agentStart)
      ? agentMessageTranscriptText(slot.message.blocks, slot.message.from, slot.message.shortened)
      : nativeChatMessageCopyText(slot.message, nativeChatStoppedBeforeStartLabel())
    : null
}

/** "Copy final message": the newest assistant reply, without the turn's tool calls. */
export function nativeChatFinalMessageCopyText(
  slots: readonly NativeChatTranscriptSlot[]
): string | null {
  for (let index = slots.length - 1; index >= 0; index--) {
    const slot = slots[index]
    if (slot?.kind === 'message' && slot.message.role === 'assistant' && !slot.message.from) {
      const text = nativeChatSlotCopyText(slots, slot.message.id)
      if (text?.trim()) {
        return text
      }
    }
  }
  return null
}
