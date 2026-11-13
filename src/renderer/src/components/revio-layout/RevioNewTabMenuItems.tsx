import type React from 'react'
import { Globe, History } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut
} from '@/components/ui/dropdown-menu'
import { openAgentSessionHistoryModal } from '@/components/right-sidebar/ai-vault/panel/agent-session-history-modal'
import { translate } from '@/i18n/i18n'
import { launchRevioChat } from './launch-revio-chat'

/** An action with no key shows no hint: "Unassigned" beside a menu item reads like a state. */
function ShortcutHint({ label }: { label: string }): React.JSX.Element | null {
  return label && label !== 'Unassigned' ? (
    <DropdownMenuShortcut>{label}</DropdownMenuShortcut>
  ) : null
}

/**
 * "+" menu in the center: a chat, a browser tab, and the chat history. The center holds chats
 * only; terminals open in the bottom panel. The workspace layout draws no icon on Chat. A cloud
 * workspace's desktop is the right panel's Desktop tab.
 */
export function RevioNewTabMenuItems({
  worktreeId,
  groupId,
  browserEnabled,
  newChatShortcut,
  newBrowserShortcut,
  onNewBrowserTab
}: {
  worktreeId: string
  groupId: string | undefined
  browserEnabled: boolean
  newChatShortcut: string
  newBrowserShortcut: string
  onNewBrowserTab: () => void
}): React.JSX.Element {
  return (
    <>
      <DropdownMenuItem onSelect={() => launchRevioChat(worktreeId, groupId)}>
        {translate('auto.components.revioLayout.newTabChat', 'Chat')}
        <ShortcutHint label={newChatShortcut} />
      </DropdownMenuItem>
      {browserEnabled ? (
        <DropdownMenuItem onSelect={onNewBrowserTab}>
          <Globe />
          {translate('auto.components.revioLayout.newTabBrowser', 'Browser')}
          <ShortcutHint label={newBrowserShortcut} />
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuSeparator />
      {/* The "View chat history": this workspace's past chats; a pick reopens it in a tab. */}
      <DropdownMenuItem
        onSelect={() =>
          openAgentSessionHistoryModal({
            workspace: { worktreeId },
            chatTabId: null,
            initialQuery: ''
          })
        }
      >
        <History />
        {translate('auto.components.revioLayout.viewChatHistory', 'View chat history')}
      </DropdownMenuItem>
    </>
  )
}
