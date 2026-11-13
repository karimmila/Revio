import type React from 'react'
import { Eye } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { requestRevioReview } from './launch-revio-chat'
import { useRevioLayout } from './revio-layout'

/** The Review: a new agent tab reviews the branch, read-only. Its menu has "Edit before
 * sending", which opens the chat with the review prompt as an unsent draft. */
export function RevioReviewButton(): React.JSX.Element | null {
  const enabled = useRevioLayout()
  const worktreeId = useAppStore((s) => s.activeWorktreeId)
  if (!enabled || !worktreeId) {
    return null
  }
  const review = (draft: boolean): void => {
    void requestRevioReview(worktreeId, draft)
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={() => review(false)}
          className="mr-1 flex h-6 items-center gap-1 rounded-md px-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Eye className="size-3.5" />
          {translate('auto.components.revioLayout.review', 'Review')}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => review(true)}>
          {translate('auto.components.revioLayout.editBeforeSending', 'Edit before sending')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
