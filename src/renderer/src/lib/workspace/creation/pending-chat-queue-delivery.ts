import { toast } from 'sonner'
import { useAppStore } from '@/store/index'
import { translate } from '@/i18n/i18n'
import { sendStructuredAgentSessionMessage } from '@/components/native-chat/structured-agent-session-message-sender'
import type { StructuredAgentSessionSent } from '@/components/native-chat/structured-agent-session-send-runtime'
import { structuredAgentSessionTargetForTab } from '@/runtime/structured-agent-session-owner'
import { getStructuredAgentSessionLaunchLifecycle } from '@/lib/agent-session/launch/structured-agent-session-launch-registry'
import type { PendingChatQueuedMessage, PendingWorktreeCreation } from './pending-worktree-creation'

const RETRY_MS = 300
// The first turn's send slot frees once the host records it; a sandbox that answers slower than
// this has a bigger problem than the queue, and the user is told what was not sent.
const SLOT_WAIT_MS = 120_000

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** One send, once the chat has opened and its single send slot is free; null on timeout. */
async function sendWhenFree(
  worktreeId: string,
  sessionId: string,
  message: PendingChatQueuedMessage,
  deadline: number
): Promise<StructuredAgentSessionSent | null> {
  while (Date.now() < deadline) {
    const state = useAppStore.getState()
    const tab = (state.unifiedTabsByWorktree[worktreeId] ?? []).find(
      (candidate) => candidate.contentType === 'agent-session' && candidate.entityId === sessionId
    )
    if (!tab) {
      return null
    }
    const target = structuredAgentSessionTargetForTab(state, tab)
    const lifecycle = getStructuredAgentSessionLaunchLifecycle(worktreeId, sessionId)
    if (target && lifecycle !== 'pending' && lifecycle !== 'cancelled') {
      const sent = sendStructuredAgentSessionMessage({
        sessionId,
        target,
        text: message.text,
        // The agent is answering the first message; the host holds these as queued cards.
        delivery: 'queue-if-active',
        ...(message.skills?.length ? { skills: message.skills } : {})
      })
      if (sent) {
        return sent
      }
    }
    await sleep(RETRY_MS)
  }
  return null
}

/**
 * Sends the messages queued while the workspace was set up, in order, after the chat's first
 * message. A message the host returns goes back to the chat's composer (the send's own hand-back);
 * the rest are named in a toast so no typed text vanishes silently.
 */
export async function deliverPendingChatQueue(args: {
  worktreeId: string
  sessionId: string
  messages: readonly PendingChatQueuedMessage[]
  firstMessageSettled?: Promise<unknown>
}): Promise<number> {
  await args.firstMessageSettled?.catch(() => undefined)
  const deadline = Date.now() + SLOT_WAIT_MS
  let delivered = 0
  // A send the host turned back is already in the composer; one never sent is not anywhere yet.
  let backInComposer = false
  for (const message of args.messages) {
    const sent = await sendWhenFree(args.worktreeId, args.sessionId, message, deadline)
    const outcome = sent ? await sent.outcome : null
    if (outcome !== 'recorded' && outcome !== 'unconfirmed') {
      backInComposer = outcome === 'returned'
      break
    }
    delivered += 1
  }
  if (delivered < args.messages.length) {
    const unsent = args.messages.slice(delivered + (backInComposer ? 1 : 0))
    toast.error(
      translate(
        'auto.lib.pendingChatQueue.notSent',
        'Some queued messages were not sent. Send them again from the chat.'
      ),
      unsent.length > 0 ? { description: unsent.map((message) => message.text).join('\n\n') } : {}
    )
  }
  return delivered
}

/** Starts `deliverPendingChatQueue` for the chat tab a creation opened, when it queued any. */
export function queuePendingChatMessages(
  worktreeId: string,
  tabId: string | null,
  pending: Pick<PendingWorktreeCreation, 'queuedChatMessages'> | undefined,
  firstMessageSettled: Promise<unknown> | undefined
): void {
  const messages = pending?.queuedChatMessages
  const tab = tabId ? useAppStore.getState().getTab(tabId) : null
  if (!messages?.length || tab?.contentType !== 'agent-session') {
    return
  }
  void deliverPendingChatQueue({
    worktreeId,
    sessionId: tab.entityId,
    messages,
    firstMessageSettled
  })
}
