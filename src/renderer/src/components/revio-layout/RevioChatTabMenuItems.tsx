import { Copy, GitFork, Mail, MailOpen } from 'lucide-react'
import { toast } from 'sonner'
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { nativeChatTabActions } from '@/components/native-chat/native-chat-tab-actions'
import { copyRevioLink } from './RevioLinkRouter'
import {
  nativeChatTranscriptCopyText,
  type NativeChatTranscriptCopyMode
} from '../../../../shared/native-chat/transcript/native-chat-transcript-copy'

const FORK_SHORTCUT = '⌘⌥↵'
const COPY_TRANSCRIPT_SHORTCUT = '⌘⌥C'

export function copyRevioChatTranscript(
  tabId: string,
  mode: NativeChatTranscriptCopyMode
): boolean {
  const actions = nativeChatTabActions(tabId)
  const text = actions ? nativeChatTranscriptCopyText(actions.items(), mode) : ''
  if (!text) {
    return false
  }
  window.api.ui.writeClipboardText(text)
  toast.success(translate('auto.components.revioLayout.transcriptCopied', 'Transcript copied'))
  return true
}

/** The chat tab items: read state, fork, transcripts and session info. */
export function RevioChatTabMenuItems({
  tabId,
  worktreeId,
  sessionId,
  agent
}: {
  tabId: string
  worktreeId: string
  sessionId: string
  agent: string | undefined
}): React.JSX.Element {
  const worktree = useAppStore((s) => findWorktreeById(selectWorktreesByRepo(s), worktreeId))
  const setUnread = useAppStore((s) => s.setWorkspaceUnreadByUser)
  const actions = nativeChatTabActions(tabId)
  const copySessionInfo = (): void => {
    const lines = [
      `Session: ${sessionId}`,
      ...(agent ? [`Agent: ${agent}`] : []),
      ...(worktree ? [`Workspace: ${worktree.displayName}`, `Path: ${worktree.path}`] : []),
      ...(worktree?.branch ? [`Branch: ${worktree.branch.replace(/^refs\/heads\//u, '')}`] : [])
    ]
    window.api.ui.writeClipboardText(lines.join('\n'))
  }
  return (
    <>
      <ContextMenuSeparator />
      {worktree ? (
        <ContextMenuItem
          onSelect={() => setUnread(worktree.id, !worktree.isUnread, worktree.hostId ?? 'local')}
        >
          {worktree.isUnread ? (
            <MailOpen className="size-3.5 shrink-0" />
          ) : (
            <Mail className="size-3.5 shrink-0" />
          )}
          {worktree.isUnread
            ? translate('auto.components.revioLayout.markRead', 'Mark as read')
            : translate('auto.components.revioLayout.markUnread', 'Mark as unread')}
        </ContextMenuItem>
      ) : null}
      <ContextMenuItem disabled={!actions?.canFork()} onSelect={() => actions?.forkLatest()}>
        <GitFork className="size-3.5 shrink-0" />
        {translate('auto.components.revioLayout.forkToNewTab', 'Fork to new tab')}
        <ContextMenuShortcut>{FORK_SHORTCUT}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!actions}
        onSelect={() => copyRevioChatTranscript(tabId, 'concise')}
      >
        <Copy className="size-3.5 shrink-0" />
        {translate('auto.components.revioLayout.copyConciseTranscript', 'Copy concise transcript')}
        <ContextMenuShortcut>{COPY_TRANSCRIPT_SHORTCUT}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        inset
        disabled={!actions}
        onSelect={() => copyRevioChatTranscript(tabId, 'full')}
      >
        {translate('auto.components.revioLayout.copyFullTranscript', 'Copy full transcript')}
      </ContextMenuItem>
      <ContextMenuItem inset onSelect={() => copyRevioLink({ worktreeId, sessionId })}>
        {translate('auto.components.revioLayout.copyLink', 'Copy link')}
      </ContextMenuItem>
      <ContextMenuItem inset onSelect={copySessionInfo}>
        {translate('auto.components.revioLayout.copySessionInfo', 'Copy session info')}
      </ContextMenuItem>
    </>
  )
}
