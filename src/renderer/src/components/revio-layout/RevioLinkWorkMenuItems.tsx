import React from 'react'
import { SquareArrowOutUpRight, Unlink } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { Worktree } from '../../../../shared/worktree/types'

/**
 * The workspace menu's one way to link work: Workspace details, on its "Linked work" field, which
 * searches issues and pull requests and takes a pasted link. A second "Link pull request…" item
 * used to sit beside it and did less.
 */
export function RevioLinkWorkMenuItems({
  worktree,
  disabled
}: {
  worktree: Pick<
    Worktree,
    'id' | 'repoId' | 'hostId' | 'displayName' | 'linkedIssue' | 'linkedPR' | 'comment'
  >
  disabled: boolean
}): React.JSX.Element {
  return (
    <>
      <DropdownMenuItem
        onSelect={() =>
          useAppStore.getState().openModal('edit-meta', {
            worktreeId: worktree.id,
            repoId: worktree.repoId,
            executionHostId: worktree.hostId,
            currentDisplayName: worktree.displayName,
            currentIssue: worktree.linkedIssue,
            currentPR: worktree.linkedPR,
            currentComment: worktree.comment,
            focus: 'issue'
          })
        }
        disabled={disabled}
      >
        <SquareArrowOutUpRight className="size-3.5" />
        {translate('auto.components.revioLayout.linkIssueOrPr', 'Link issue or PR…')}
      </DropdownMenuItem>
      {worktree.linkedPR ? (
        <DropdownMenuItem
          onSelect={() =>
            void useAppStore.getState().updateWorktreeMeta(worktree.id, { linkedPR: null })
          }
          disabled={disabled}
        >
          <Unlink className="size-3.5" />
          {translate('auto.components.revioLayout.unlinkPr', 'Unlink PR #{{value0}}', {
            value0: worktree.linkedPR
          })}
        </DropdownMenuItem>
      ) : null}
    </>
  )
}
