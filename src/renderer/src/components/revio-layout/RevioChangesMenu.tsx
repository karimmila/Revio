import React from 'react'
import { Check, EllipsisVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { translate } from '@/i18n/i18n'
import { RevioBranchCommitItems } from './RevioBranchCommitItems'
import { requestRevioBranchCommits } from './revio-branch-commits'
import { RIGHT_SIDEBAR_HEADER_NO_DRAG_CLASS_NAME } from '@/components/right-sidebar/right-sidebar-titlebar-drag-regions'
import {
  requestRevioTargetBranchPicker,
  setRevioChangesMode,
  useRevioChangesMode
} from './revio-changes-mode'

// Key symbols, not words: they read the same in every locale.
const UNCOMMITTED_SHORTCUT_LABEL = '\u2318\u2325U'

function useActiveBranchAndBase(): { branch: string; base: string | null } {
  const branch = useAppStore((s) => {
    const worktree = s.activeWorktreeId
      ? findWorktreeById(selectWorktreesByRepo(s), s.activeWorktreeId)
      : undefined
    return worktree?.branch.replace(/^refs\/heads\//, '') ?? ''
  })
  const base = useAppStore((s) =>
    s.activeWorktreeId
      ? (s.gitBranchCompareSummaryByWorktree?.[s.activeWorktreeId]?.baseRef ?? null)
      : null
  )
  return { branch, base }
}

/**
 * The Changes "⋮" menu: the branch and its target, then All changes or Uncommitted changes
 * (⌘⌥U toggles). Shown beside Review while the Changes tab is open.
 */
export function RevioChangesMenu({ visible }: { visible: boolean }): React.JSX.Element | null {
  const mode = useRevioChangesMode()
  const uncommittedCount = useAppStore((s) =>
    s.activeWorktreeId ? (s.gitStatusByWorktree?.[s.activeWorktreeId]?.length ?? 0) : 0
  )
  const setRightSidebarTab = useAppStore((s) => s.setRightSidebarTab)
  const { branch, base } = useActiveBranchAndBase()

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey && event.altKey && !event.shiftKey && event.code === 'KeyU') {
        event.preventDefault()
        setRevioChangesMode(mode === 'uncommitted' ? 'all' : 'uncommitted')
        setRightSidebarTab('source-control')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, setRightSidebarTab])

  if (!visible) {
    return null
  }
  return (
    <DropdownMenu
      modal={false}
      onOpenChange={(open) => {
        if (open) {
          requestRevioBranchCommits()
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={translate('auto.components.revioLayout.changesOptions', 'Changes options')}
          className={`mr-1 flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${RIGHT_SIDEBAR_HEADER_NO_DRAG_CLASS_NAME}`}
        >
          <EllipsisVertical className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-2.5 py-2 text-[12.5px]">
          <span className="text-muted-foreground">
            {translate('auto.components.revioLayout.currentBranch', 'Current branch')}
          </span>
          <span className="truncate">{branch}</span>
          <span className="text-muted-foreground">
            {translate('auto.components.revioLayout.targetBranch', 'Target branch')}
          </span>
          <span className="truncate">{base ?? '—'}</span>
        </div>
        <DropdownMenuItem onSelect={requestRevioTargetBranchPicker}>
          {translate('auto.components.revioLayout.selectTargetBranch', 'Select target branch...')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setRevioChangesMode('all')}>
          {translate('auto.components.revioLayout.allChanges', 'All changes')}
          {mode === 'all' ? <Check className="ml-auto size-3.5" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setRevioChangesMode('uncommitted')}>
          <span className="flex min-w-0 flex-col">
            <span>
              {translate('auto.components.revioLayout.uncommittedChanges', 'Uncommitted changes')}
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              {uncommittedCount > 0
                ? translate('auto.components.revioLayout.uncommittedCount', '{{value0}} files', {
                    value0: uncommittedCount,
                    count: uncommittedCount,
                    defaultValue_one: '{{value0}} file'
                  })
                : translate('auto.components.revioLayout.noUncommitted', 'No uncommitted changes')}
            </span>
          </span>
          {mode === 'uncommitted' ? (
            <Check className="ml-auto size-3.5" />
          ) : (
            <DropdownMenuShortcut>{UNCOMMITTED_SHORTCUT_LABEL}</DropdownMenuShortcut>
          )}
        </DropdownMenuItem>
        <RevioBranchCommitItems />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
