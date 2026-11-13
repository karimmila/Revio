import React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { GitStatusEntry } from '../../../../shared/git/status/git-status-types'
import type { GitBranchChangeEntry } from '../../../../shared/git/diff/git-diff-compare-types'
import { formatCompactCount } from './revio-layout'
import { useRevioChangesMode } from './revio-changes-mode'
import { RevioBusyGitNotice } from './RevioBusyGitNotice'
import { diffChangeSignature, useDiffFileViewed } from '@/lib/diff-viewed-store'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'

const NO_BRANCH_ENTRIES: readonly GitBranchChangeEntry[] = []

type ChangeRow = {
  path: string
  letter: string
  added: number
  removed: number
  open: () => void
  /** The path's uncommitted change, which "Discard changes" reverts. */
  uncommitted?: GitStatusEntry
  /** An unresolved merge conflict; the workspace layout lists these first under "Conflicts". */
  conflicted?: boolean
}

const STATUS_LETTERS: Record<string, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  untracked: 'U',
  conflicted: '!',
  typechange: 'T'
}

function letterFor(status: string): string {
  return STATUS_LETTERS[status] ?? status.slice(0, 1).toUpperCase()
}

/** One row per path: a committed change and a newer uncommitted one add up; the newer diff opens. */
export function buildChangeRows(
  statusEntries: readonly GitStatusEntry[],
  branchEntries: readonly GitBranchChangeEntry[],
  onOpenUncommitted: (entry: GitStatusEntry) => void,
  onOpenCommitted: (entry: GitBranchChangeEntry) => void
): ChangeRow[] {
  const rows = new Map<string, ChangeRow>()
  for (const entry of branchEntries) {
    rows.set(entry.path, {
      path: entry.path,
      letter: letterFor(entry.status),
      added: entry.added ?? 0,
      removed: entry.removed ?? 0,
      open: () => onOpenCommitted(entry)
    })
  }
  for (const entry of statusEntries) {
    const previous = rows.get(entry.path)
    const conflicted = entry.conflictStatus === 'unresolved'
    rows.set(entry.path, {
      path: entry.path,
      letter: conflicted ? STATUS_LETTERS.conflicted : letterFor(entry.status),
      conflicted,
      added: (previous?.added ?? 0) + (entry.added ?? 0),
      removed: (previous?.removed ?? 0) + (entry.removed ?? 0),
      open: () => onOpenUncommitted(entry),
      uncommitted: entry
    })
  }
  return [...rows.values()].sort(
    (a, b) => Number(!!b.conflicted) - Number(!!a.conflicted) || a.path.localeCompare(b.path)
  )
}

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return (
    <div className="px-1.5 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">{title}</div>
  )
}

/** The mark on a Changes row whose file was marked Viewed in the diff. */
function ViewedMark({
  worktreeId,
  path,
  added,
  removed
}: {
  worktreeId: string | null | undefined
  path: string
  added: number
  removed: number
}): React.JSX.Element | null {
  const viewed = useDiffFileViewed(worktreeId, path, diffChangeSignature(added, removed))
  return viewed ? (
    <Check
      aria-label={translate('auto.components.editor.diffViewed', 'Viewed')}
      className="size-3 shrink-0 text-muted-foreground"
    />
  ) : null
}

function LineCounts({ added, removed }: { added: number; removed: number }): React.JSX.Element {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10.5px] tabular-nums">
      {added > 0 ? (
        <span className="text-[color:var(--git-decoration-added)]">
          +{formatCompactCount(added)}
        </span>
      ) : null}
      {removed > 0 ? (
        <span className="text-[color:var(--git-decoration-deleted)]">
          -{formatCompactCount(removed)}
        </span>
      ) : null}
    </span>
  )
}

/** The Changes tab: "N files changed +A -R" over one flat list of paths. */
export function RevioChangesList({
  statusEntries,
  branchEntries,
  onOpenUncommitted,
  onOpenCommitted,
  onDiscard,
  worktreeId,
  commitSurface
}: {
  statusEntries: readonly GitStatusEntry[]
  branchEntries: readonly GitBranchChangeEntry[]
  onOpenUncommitted: (entry: GitStatusEntry) => void
  onOpenCommitted: (entry: GitBranchChangeEntry) => void
  /** Asks to revert one uncommitted file; Orca's confirmation follows. */
  onDiscard?: (entry: GitStatusEntry) => void
  worktreeId?: string | null
  commitSurface: React.ReactNode
}): React.JSX.Element {
  const [commitOpen, setCommitOpen] = React.useState(false)
  const [filter, setFilter] = React.useState('')
  const mode = useRevioChangesMode()
  const allRows = buildChangeRows(
    statusEntries,
    mode === 'uncommitted' ? NO_BRANCH_ENTRIES : branchEntries,
    onOpenUncommitted,
    onOpenCommitted
  )
  const needle = filter.trim().toLowerCase()
  const rows = needle ? allRows.filter((row) => row.path.toLowerCase().includes(needle)) : allRows
  const added = rows.reduce((sum, row) => sum + row.added, 0)
  const removed = rows.reduce((sum, row) => sum + row.removed, 0)
  const conflictCount = rows.filter((row) => row.conflicted).length
  const hasUncommitted = statusEntries.length > 0
  // Orca's own empty message already covers a clean branch; a "0 files changed" row would repeat it.
  if (allRows.length === 0 && !hasUncommitted) {
    return (
      <div className="min-h-0">
        <RevioBusyGitNotice worktreeId={worktreeId} />
      </div>
    )
  }
  return (
    <div className="flex min-h-0 flex-col">
      <RevioBusyGitNotice worktreeId={worktreeId} />
      <div className="flex h-8 shrink-0 items-center gap-2 px-3 text-[12.5px] text-foreground/85">
        <span>
          {mode === 'uncommitted'
            ? translate(
                'auto.components.revioLayout.uncommittedFiles',
                '{{count}} uncommitted files',
                { count: rows.length, defaultValue_one: '{{count}} uncommitted file' }
              )
            : translate('auto.components.revioLayout.filesChanged', '{{count}} files changed', {
                count: rows.length,
                defaultValue_one: '{{count}} file changed'
              })}
        </span>
        {hasUncommitted ? (
          <button
            type="button"
            onClick={() => setCommitOpen((open) => !open)}
            aria-expanded={commitOpen}
            className="flex items-center gap-0.5 rounded-md px-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {translate('auto.components.revioLayout.commit', 'Commit')}
            <ChevronDown
              className={cn('size-3 transition-transform', commitOpen && 'rotate-180')}
            />
          </button>
        ) : null}
        <span className="ml-auto">
          <LineCounts added={added} removed={removed} />
        </span>
      </div>
      {commitOpen && hasUncommitted ? <div className="shrink-0">{commitSurface}</div> : null}
      {allRows.length > 8 || needle ? (
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={translate(
            'auto.components.revioLayout.filterChangedFiles',
            'Filter changed files'
          )}
          className="mx-3 mb-1 h-7 shrink-0 rounded-md border border-border bg-transparent px-2 text-[12px] outline-none placeholder:text-muted-foreground focus:border-ring"
        />
      ) : null}
      <div className="min-h-0 px-1.5">
        {rows.map((row, index) => {
          const header =
            conflictCount === 0 ? null : index === 0 ? (
              <SectionHeader
                key="conflicts"
                title={translate('auto.components.revioLayout.conflicts', 'Conflicts')}
              />
            ) : index === conflictCount ? (
              <SectionHeader
                key="clean"
                title={translate('auto.components.revioLayout.clean', 'Clean')}
              />
            ) : null
          const slash = row.path.lastIndexOf('/')
          const directory = slash !== -1 ? row.path.slice(0, slash + 1) : ''
          const name = slash !== -1 ? row.path.slice(slash + 1) : row.path
          const button = (
            <button
              key={row.path}
              type="button"
              onClick={row.open}
              title={row.path}
              className="flex h-[27px] w-full items-center gap-2 rounded-md px-1.5 text-left text-[12.5px] transition-colors hover:bg-accent"
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="text-muted-foreground">{directory}</span>
                <span className="text-foreground/90">{name}</span>
              </span>
              <span className="w-3 shrink-0 text-center text-[11px] text-muted-foreground">
                {row.letter}
              </span>
              <ViewedMark
                worktreeId={worktreeId}
                path={row.path}
                added={row.added}
                removed={row.removed}
              />
              <LineCounts added={row.added} removed={row.removed} />
            </button>
          )
          const { uncommitted } = row
          if (!uncommitted || !onDiscard) {
            return header ? [header, button] : button
          }
          const menu = (
            <ContextMenu key={row.path}>
              <ContextMenuTrigger asChild>{button}</ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem variant="destructive" onSelect={() => onDiscard(uncommitted)}>
                  {translate('auto.components.revioLayout.discardChanges', 'Discard changes')}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )
          return header ? [header, menu] : menu
        })}
      </div>
    </div>
  )
}
