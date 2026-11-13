import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { AiVaultSession } from '../../../../shared/ai-vault/contracts/ai-vault-types'
import { pastChatAttachmentText, pastChatsForWorkspace } from './native-chat-past-chats'

/** "Add chat transcripts:" on a fresh chat: this workspace's recent past chats; a pick
 * puts its transcript in the chat input. */
export function NativeChatPastChats({
  workspacePath,
  onPick
}: {
  workspacePath: string | null
  onPick: (from: Element, text: string) => void
}): React.JSX.Element | null {
  const [past, setPast] = useState<readonly AiVaultSession[]>([])
  useEffect(() => {
    if (!workspacePath) {
      return
    }
    let current = true
    void window.api.aiVault
      .listSessions({ scopePaths: [workspacePath], limit: 50 })
      .then((result) => {
        if (current) {
          setPast(pastChatsForWorkspace(result.sessions, workspacePath))
        }
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [workspacePath])
  if (past.length === 0) {
    return null
  }
  return (
    <div data-native-chat-past-chats className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-xs text-muted-foreground">
        {translate('components.native-chat.pastChats.label', 'Add chat transcripts:')}
      </span>
      {past.map((session) => (
        <Button
          key={session.id}
          type="button"
          variant="outline"
          size="sm"
          title={session.title}
          className="max-w-56"
          onClick={(event) => onPick(event.currentTarget, pastChatAttachmentText(session))}
        >
          <History className="size-3.5" />
          <span className="truncate">{session.title}</span>
        </Button>
      ))}
    </div>
  )
}
