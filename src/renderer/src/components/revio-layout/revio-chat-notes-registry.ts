/**
 * Review notes shown as chips in a chat's composer ride along with its next message. The chips own
 * the notes; the send path, which must not import the layout or the store, asks here by draft
 * scope.
 */
type ChatNotesProvider = { prefix: () => string; delivered: () => void }

const providers = new Map<string, ChatNotesProvider>()

export function registerRevioChatNotes(
  draftScopeKey: string,
  provider: ChatNotesProvider
): () => void {
  providers.set(draftScopeKey, provider)
  return () => {
    if (providers.get(draftScopeKey) === provider) {
      providers.delete(draftScopeKey)
    }
  }
}

/** The notes to put before this message, and what to call once the chat accepts it. */
export function takeRevioChatNotes(
  draftScopeKey: string
): { prefix: string; delivered: () => void } | null {
  const provider = providers.get(draftScopeKey)
  const prefix = provider?.prefix() ?? ''
  return provider && prefix ? { prefix, delivered: provider.delivered } : null
}
