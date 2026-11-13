import React from 'react'
import { ArrowUp } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { sendMessageToAgent } from '@/lib/agent-message-send'
import { isStructuredTab } from '../../../../shared/agent-session/view/structured-agent-session-tab'
import { launchRevioAgentChat } from './launch-revio-chat'
import { revioSendsWithModEnter } from './revio-root-flags'
import { RevioNoteChips, useChatNotes } from './revio-note-chips'

// Unsent text per workspace, so switching files keeps what you typed.
const drafts = new Map<string, string>()

/** The workspace's chat you looked at last: where a message typed under a file goes. */
function useTargetChat(worktreeId: string): { sessionId: string; title: string } | null {
  // A string key keeps the selector stable; tabs re-render often while chats stream.
  const key = useAppStore((s) => {
    let best: { sessionId: string; title: string; at: number } | null = null
    for (const tab of s.unifiedTabsByWorktree[worktreeId] ?? []) {
      const at = tab.lastFocusedAt ?? tab.createdAt ?? 0
      if (isStructuredTab(tab) && (!best || at > best.at)) {
        best = { sessionId: tab.entityId, title: tab.customLabel ?? '', at }
      }
    }
    return best ? `${best.sessionId}\u0000${best.title}` : ''
  })
  if (!key) {
    return null
  }
  const [sessionId = '', title = ''] = key.split('\u0000')
  return { sessionId, title }
}

/**
 * The workspace layout keeps the chat under a file or diff: notes you add on lines show here as
 * chips, and a message (with those notes) goes to the workspace's chat without leaving the file.
 */
export function RevioDockedComposer({ worktreeId }: { worktreeId: string }): React.JSX.Element {
  const target = useTargetChat(worktreeId)
  const { notes, prefix, markDelivered } = useChatNotes(worktreeId)
  const [text, setText] = React.useState(() => drafts.get(worktreeId) ?? '')
  const [sending, setSending] = React.useState(false)
  React.useEffect(() => setText(drafts.get(worktreeId) ?? ''), [worktreeId])
  const update = (next: string): void => {
    drafts.set(worktreeId, next)
    setText(next)
  }
  const canSend = !sending && (text.trim() !== '' || notes.length > 0)
  const [focused, setFocused] = React.useState(false)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  // The workspace layout keeps the box to one line until you use it, so it never crowds the file.
  const expanded = focused || text.trim() !== ''
  const focusInput = (event: React.MouseEvent): void => {
    if (event.target === event.currentTarget) {
      event.preventDefault()
      inputRef.current?.focus()
    }
  }

  const send = async (): Promise<void> => {
    if (!canSend) {
      return
    }
    const prompt = [prefix(), text.trim()].filter(Boolean).join('\n\n')
    setSending(true)
    try {
      if (!target) {
        // No chat yet: start one with the message. Its first send can still fail, and nothing
        // reports back here, so the notes stay until the chat confirms or you remove them.
        if (launchRevioAgentChat(worktreeId, { prompt })) {
          update('')
        }
        return
      }
      const result = await sendMessageToAgent({
        worktreeId,
        target: { kind: 'structured-session', sessionId: target.sessionId },
        prompt
      })
      if (result.status === 'sent' || result.status === 'unconfirmed') {
        markDelivered()
        update('')
      } else {
        toast.error(
          translate(
            'auto.components.revioLayout.dockedSendFailed',
            "The chat isn't ready for a message yet."
          )
        )
      }
    } finally {
      setSending(false)
    }
  }

  const sendButton = (
    <button
      type="button"
      data-native-chat-send=""
      disabled={!canSend}
      aria-label={translate('auto.components.revioLayout.dockedSend', 'Send message')}
      // Taking focus would open the box under the pointer mid-click.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => void send()}
    >
      <ArrowUp className="size-3.5" />
    </button>
  )
  return (
    <div
      data-revio-docked-composer=""
      data-expanded={expanded ? 'true' : undefined}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        // Moving focus between the box's own controls keeps it open.
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false)
        }
      }}
    >
      <div data-revio-docked-box="" onMouseDown={focusInput}>
        {expanded ? <RevioNoteChips notes={notes} /> : null}
        <div data-revio-docked-input-row="">
          <textarea
            ref={inputRef}
            value={text}
            rows={expanded ? 3 : 1}
            placeholder={
              expanded
                ? translate(
                    'auto.components.revioLayout.dockedPlaceholder',
                    'Ask to make changes, @mention files, run /commands'
                  )
                : translate('auto.components.revioLayout.dockedCollapsed', 'Add a follow up')
            }
            onChange={(event) => update(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.currentTarget.blur()
                return
              }
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
                return
              }
              const modified = event.metaKey || event.ctrlKey
              const sends = revioSendsWithModEnter() ? modified : !modified && !event.shiftKey
              if (sends) {
                event.preventDefault()
                void send()
              }
            }}
          />
          {expanded ? null : (
            <>
              {notes.length > 0 ? (
                <span data-revio-docked-hint="">
                  {translate('auto.components.revioLayout.dockedNotes', '{{count}} notes', {
                    count: notes.length,
                    defaultValue_one: '{{count}} note'
                  })}
                </span>
              ) : null}
              {sendButton}
            </>
          )}
        </div>
        {expanded ? (
          <div data-revio-docked-footer="">
            <span className="truncate">
              {!target
                ? translate('auto.components.revioLayout.dockedNewChat', 'Starts a new chat')
                : target.title
                  ? translate('auto.components.revioLayout.dockedTarget', 'To {{value0}}', {
                      value0: target.title
                    })
                  : translate('auto.components.revioLayout.dockedLatest', 'To your latest chat')}
            </span>
            {sendButton}
          </div>
        ) : null}
      </div>
    </div>
  )
}
