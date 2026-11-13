import React from 'react'
import { FileText, X } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { useVisibleWorktreeDiffComments } from '@/components/diff-comments/use-visible-worktree-diff-comments'
import type { DiffComment } from '../../../../shared/diff-comment-types'
import { formatDiffComments } from '../../../../shared/diff-comments-format'
import {
  clearChatAdditions,
  isChatAdditionId,
  removeChatAddition,
  useChatAdditions
} from './revio-chat-additions'

// Notes taken out of the next message with "Remove from chat"; they stay on the diff.
const excluded = new Set<string>()
const listeners = new Set<() => void>()
let version = 0

function bump(): void {
  version += 1
  for (const listener of listeners) {
    listener()
  }
}

export function excludeNoteFromChat(noteId: string): void {
  if (isChatAdditionId(noteId)) {
    removeChatAddition(noteId)
    return
  }
  excluded.add(noteId)
  bump()
}

/**
 * The workspace's unsent review notes, plus pull request comments added with "Add to chat", that
 * ride along with the next chat message, as the workspace layout attaches them to the composer.
 * Sending clears them the way Orca's "Send notes" does.
 */
export function useChatNotes(worktreeId: string | null): {
  notes: DiffComment[]
  prefix: () => string
  markDelivered: () => void
} {
  React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version
  )
  const { owner, comments } = useVisibleWorktreeDiffComments(worktreeId, 'selection')
  const clearDelivered = useAppStore((s) => s.clearDeliveredDiffComments)
  const lineNotes = comments.filter((note) => !note.sentAt && !excluded.has(note.id))
  const additions = useChatAdditions(worktreeId)
  return {
    notes: [...lineNotes, ...additions],
    prefix: () =>
      [lineNotes.length > 0 ? formatDiffComments(lineNotes) : '', ...additions.map((a) => a.prompt)]
        .filter(Boolean)
        .join('\n\n'),
    markDelivered: () => {
      if (owner && lineNotes.length > 0) {
        void clearDelivered(owner, lineNotes)
      }
      if (worktreeId) {
        clearChatAdditions(worktreeId)
      }
    }
  }
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** The note chips: file name, then the note, with a way to leave it out of the message. */
export function RevioNoteChips({
  notes
}: {
  notes: readonly DiffComment[]
}): React.JSX.Element | null {
  if (notes.length === 0) {
    return null
  }
  return (
    <div data-revio-note-chips="">
      {notes.map((note) => (
        <span key={note.id} data-revio-note-chip="" title={note.body}>
          <FileText className="size-3.5 shrink-0" />
          <span data-revio-note-chip-file="">{basename(note.filePath)}</span>
          <span className="truncate">{note.body}</span>
          <button
            type="button"
            aria-label={translate(
              'auto.components.revioLayout.removeNoteFromChat',
              'Remove from chat'
            )}
            onClick={() => excludeNoteFromChat(note.id)}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  )
}
