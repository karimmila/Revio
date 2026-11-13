import React from 'react'
import { ChevronDown } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useStructuredChatTabConversationName } from '@/runtime/structured-conversation-name'
import { revioLayoutActive } from './revio-root-flags'
import { retargetRevioChat, workspaceChatTabs } from './revio-chat-send-target'
import type { Tab } from '../../../../shared/tab-types'

function ChatName({ tab }: { tab: Tab }): React.JSX.Element {
  const conversationName = useStructuredChatTabConversationName(tab)
  return (
    <span className="truncate">
      {tab.customLabel ??
        conversationName ??
        translate('auto.components.revioLayout.untitledChat', 'Untitled')}
    </span>
  )
}

/** "Sending to" over the composer, shown when the workspace has more than one chat. */
export function RevioSendingToPicker({
  tabId,
  worktreeId
}: {
  tabId: string
  worktreeId: string | null
}): React.JSX.Element | null {
  const tabs = useAppStore((state) =>
    worktreeId ? state.unifiedTabsByWorktree[worktreeId] : undefined
  )
  const chats = React.useMemo(() => workspaceChatTabs(tabs), [tabs])
  const current = chats.find((tab) => tab.id === tabId)
  if (!worktreeId || !current || chats.length < 2 || !revioLayoutActive()) {
    return null
  }
  return (
    <div data-revio-sending-to="" className="flex min-w-0 items-center gap-1 px-1 pb-1">
      <span className="shrink-0 text-xs text-muted-foreground">
        {translate('auto.components.revioLayout.sendingTo', 'Sending to')}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-5 max-w-[200px] min-w-0 items-center rounded-md px-1.5 text-xs hover:bg-muted"
          >
            <ChatName tab={current} />
            <ChevronDown className="ml-1 size-3 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={current.id}
            onValueChange={(target) => retargetRevioChat(worktreeId, current.id, target)}
          >
            {chats.map((tab) => (
              <DropdownMenuRadioItem key={tab.id} value={tab.id}>
                <ChatName tab={tab} />
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
