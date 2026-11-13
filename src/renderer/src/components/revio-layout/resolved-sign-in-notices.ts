import { nativeChatNoticeBlock } from '../../../../shared/native-chat/native-chat-notice'
import { readWholeAgentSessionFailureFact } from '../../../../shared/agent-session/failures/agent-session-failure'
import type { NativeChatMessage } from '../../../../shared/native-chat/native-chat-types'

function signInNotice(message: NativeChatMessage): { account?: string } | null {
  if (message.role !== 'system') {
    return null
  }
  const failure = readWholeAgentSessionFailureFact(nativeChatNoticeBlock(message.blocks)?.failure)
  return failure?.kind === 'notSignedIn' ? { account: failure.account } : null
}

/**
 * A "Sign in" notice is history once the agent has answered after it, or once an Orca account is
 * selected for a chat that failed with none. The workspace layout drops those notices so a
 * connected chat shows no stale warning; an expired selected account's notice still shows.
 */
export function withoutResolvedSignInNotices(
  messages: NativeChatMessage[],
  enabled: boolean,
  accountSelected: boolean
): NativeChatMessage[] {
  if (!enabled) {
    return messages
  }
  let answeredLater = false
  const kept: NativeChatMessage[] = []
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role === 'assistant') {
      answeredLater = true
    }
    const notice = signInNotice(message)
    const resolved =
      notice !== null && (answeredLater || (accountSelected && notice.account !== 'managed'))
    if (!resolved) {
      kept.push(message)
    }
  }
  return kept.length === messages.length ? messages : kept.toReversed()
}
