import type React from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { PRCommentGroup } from '../../../../shared/source-control/review-comments/pr-comment-groups'
import { addPRCommentsToActiveChat } from './revio-chat-additions'
import { revioLayoutActive } from './revio-root-flags'

/** "Add all to chat" above the pull request comments; hidden outside the layout. */
export function RevioAddAllToChatButton({
  groups
}: {
  groups: readonly PRCommentGroup[]
}): React.JSX.Element | null {
  if (!revioLayoutActive() || groups.length === 0) {
    return null
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="text-muted-foreground"
      onClick={() => addPRCommentsToActiveChat(groups)}
    >
      {translate('auto.components.revioLayout.addAllToChat', 'Add all to chat')}
    </Button>
  )
}
