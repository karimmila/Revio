import React from 'react'
import { MessageSquare } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { launchRevioChat } from './launch-revio-chat'

// One automatic chat per workspace per session, so a failed launch cannot loop.
const autoOpenedWorkspaces = new Set<string>()

/**
 * When every tab in a workspace is closed, the workspace layout opens a fresh "Untitled" chat in
 * its place. The fork does the same once per session; the button covers a launch that did not
 * start.
 */
export function RevioEmptyWorkspace({
  worktreeId,
  groupId
}: {
  worktreeId: string
  groupId: string
}): React.JSX.Element {
  React.useEffect(() => {
    if (autoOpenedWorkspaces.has(worktreeId)) {
      return
    }
    autoOpenedWorkspaces.add(worktreeId)
    launchRevioChat(worktreeId, groupId)
  }, [groupId, worktreeId])
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
      <p className="text-[13px] text-muted-foreground">
        {translate('auto.components.revioLayout.noChatsOpen', 'No chats open')}
      </p>
      <button
        type="button"
        onClick={() => launchRevioChat(worktreeId, groupId)}
        className="flex h-8 items-center gap-2 rounded-md border border-border px-3 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <MessageSquare className="size-3.5" />
        {translate('auto.components.revioLayout.newChatButton', 'New chat')}
      </button>
    </div>
  )
}
