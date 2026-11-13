import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ConfirmationDialogContextValue } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import type { AgentSessionRewindResult } from '../../../../shared/agent-session/lifecycle/agent-session-rewind'
import {
  createAgentSessionRewindHook,
  type AgentSessionRewindInput
} from '../../../../shared/agent-session/lifecycle/agent-session-rewind-request'
import { sayNativeChatRewind } from './native-chat-rewind-copy'
import type {
  CaptureStructuredAgentSessionPresentation,
  StructuredAgentSessionWriteOutcome
} from './use-structured-agent-session-mutate'
import { returnMessageToComposer } from './structured-agent-session-message-hand-back'
import type { NativeChatRewindSurface } from './use-native-chat-rewind-host'
import { restoreTurnCheckpointForSession } from '@/lib/turn-checkpoints'
import { revioLayoutActive } from '../revio-layout/revio-root-flags'

export type RewindInput = Omit<
  AgentSessionRewindInput,
  'capturePresentation' | 'returnToComposer' | 'send' | 'notify'
> & {
  capturePresentation: CaptureStructuredAgentSessionPresentation
  /** The composer the discarded message returns to, after whatever is typed there. */
  composerScopeKey?: string
  send: (fields: {
    itemId: string
    expectedEpoch: string
  }) => Promise<StructuredAgentSessionWriteOutcome<AgentSessionRewindResult>>
}

const useAgentSessionRewind = createAgentSessionRewindHook(
  { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState },
  sayNativeChatRewind
)
const notify = { error: toast.error, message: toast.message }

export function useNativeChatRewind(input: RewindInput) {
  const rewind = useAgentSessionRewind(
    useMemo(() => {
      const scope = input.composerScopeKey
      return {
        ...input,
        notify,
        ...(scope
          ? {
              returnToComposer: (
                itemId: string,
                blocks: Parameters<typeof returnMessageToComposer>[2]
              ) => {
                returnMessageToComposer(scope, `rewound-${itemId}`, blocks)
              }
            }
          : {})
      }
    }, [input])
  )
  const sharedRequest = rewind.request
  const { sessionId, state } = input
  const request = useCallback(
    async (itemId: string, confirm: ConfirmationDialogContextValue) => {
      // "Also reset files": the files go back to their checkpoint from before it.
      const sentAt = state.items.find((item) => item.itemId === itemId)?.observedAt
      const offerReset = sentAt !== undefined && revioLayoutActive()
      let resetFiles = false
      await sharedRequest(itemId, () =>
        confirm({
          ...(offerReset
            ? {
                dontAskAgain: {
                  label: translate('components.native-chat.rewind.resetFiles', 'Also reset files'),
                  onConfirmed: () => {
                    resetFiles = true
                  }
                }
              }
            : {}),
          title: translate('components.native-chat.rewind.title', 'Rewind to here?'),
          description: translate(
            'components.native-chat.rewind.confirmation',
            'Discard this message and everything after it? The message returns to the composer so you can edit and resend it. File changes on disk are kept.'
          ),
          confirmLabel: translate('components.native-chat.rewind.confirm', 'Rewind'),
          cancelLabel: translate('components.native-chat.rewind.cancel', 'Cancel'),
          confirmVariant: 'destructive',
          cancelVariant: 'ghost'
        })
      )
      if (resetFiles && sentAt !== undefined) {
        const restored = await restoreTurnCheckpointForSession(sessionId, sentAt).catch(() => false)
        if (!restored) {
          toast.error(
            translate(
              'components.native-chat.rewind.resetFilesFailed',
              'No checkpoint from before this message, so the files were kept.'
            )
          )
        }
      }
    },
    [sessionId, sharedRequest, state.items]
  )
  const shared = rewind.surface
  const surface = useMemo<NativeChatRewindSurface | undefined>(
    () => shared && { ...shared, request },
    [shared, request]
  )
  return { ...rewind, request, surface }
}

export type { NativeChatRewindHost, NativeChatRewindSurface } from './use-native-chat-rewind-host'
