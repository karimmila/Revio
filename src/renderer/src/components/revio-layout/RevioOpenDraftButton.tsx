import React from 'react'
import { PencilLine } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import {
  readNativeChatComposerDraft,
  structuredAgentSessionDraftScopeKey,
  subscribeToNativeChatComposerDraft
} from '@/components/native-chat/native-chat-composer-draft-store'

type ChatRef = { tabId: string; scopeKey: string }

/** The tab of the first chat whose draft has text. */
export function firstDraftedTab(
  refs: readonly ChatRef[],
  readText: (scopeKey: string) => string
): string | null {
  return refs.find((ref) => readText(ref.scopeKey).trim() !== '')?.tabId ?? null
}

/** The first of the workspace's chats whose composer holds unsent text, or null. */
function useDraftedChat(worktreeId: string): string | null {
  const chats = useAppStore(
    useShallow((s) =>
      (s.unifiedTabsByWorktree[worktreeId] ?? []).flatMap((tab) =>
        tab.contentType === 'agent-session' ? [`${tab.id}\n${tab.entityId}`] : []
      )
    )
  )
  const refs = React.useMemo<ChatRef[]>(
    () =>
      chats.map((entry) => {
        const [tabId, sessionId] = entry.split('\n')
        return {
          tabId: tabId ?? '',
          scopeKey: structuredAgentSessionDraftScopeKey(sessionId ?? '')
        }
      }),
    [chats]
  )
  const subscribe = React.useCallback(
    (listener: () => void) => {
      const stops = refs.map((ref) => subscribeToNativeChatComposerDraft(ref.scopeKey, listener))
      return () => stops.forEach((stop) => stop())
    },
    [refs]
  )
  return React.useSyncExternalStore(subscribe, () =>
    firstDraftedTab(refs, (scopeKey) => readNativeChatComposerDraft(scopeKey).text)
  )
}

/** "Open draft" on a sidebar row whose chat holds an unsent message. */
export function RevioOpenDraftButton({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const tabId = useDraftedChat(worktreeId)
  if (!tabId) {
    return null
  }
  const label = translate('auto.components.revioLayout.openDraft', 'Open draft')
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        activateAndRevealWorktree(worktreeId)
        useAppStore.getState().activateTab(tabId, { worktreeId })
      }}
      className="flex size-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
    >
      <PencilLine className="size-3" />
    </button>
  )
}
