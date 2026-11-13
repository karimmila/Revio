/** Fired once a chat accepts a message the user typed; the workspace layout then offers the next
 *  unread workspace. A window event keeps the send path free of layout imports. */
const EVENT = 'orca:native-chat-message-sent'

export function announceNativeChatMessageSent(): void {
  window.dispatchEvent(new Event(EVENT))
}

export function onNativeChatMessageSent(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
